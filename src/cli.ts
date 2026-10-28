import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import * as WIT from './wit';
import { CallRecord, qualified, qualifiedResource, unversioned } from './call-record';
import {
  AnswerLine, CallLine, Divergence, implementedImports, parseAnswer, parseScript, Script, scriptHeader, scriptLines, ScriptLine, writeScript,
} from './answers';
import { Answer, DEFAULTS_LEVELS, DefaultsLevel } from './answering';
import { answeredValue, CallEntry, CallLog, ImportEntry, isOwnCall, StreamEntry } from './call-log';
import { Driver, Stopped } from './driver';
import { JSPI_SUPPORTED, loadComponent } from './loader';
import { mapHandles } from './wave';
import { byImportName } from './host-resources';
import { importTemplate } from './import-template';
import { nodePlatform } from './platform-node';
import { definedResources, describeInstance } from './resources';

// The command line of component-ui, for running a component without the UI, e.g. by an agent:
//
//     component-ui inspect calc.wasm
//     component-ui call calc.wasm 'docs:calc/calc@0.1.0.eval-expression(add, 1, 2)' --answers answers.txt
//
// Calls are written as the console shows them, and run in order on one instance. The imports
// that ask, i.e. those not implemented in JavaScript, are answered from `--answers` and
// `--answer`, in the order the guest calls them, then from the happy path (see src/answers.ts).
// A run stops at the first import without an answer, which it reports with the type of value
// it expects, and the instances the answer could use.

const USAGE = `Usage:
  component-ui inspect <component.wasm>
      Shows the exports to call, the imports that ask for answers, and the types they use.
  component-ui template <component.wasm> <pkg>
      Prints a module implementing an imported package, e.g. 'docs:adder/add', in JavaScript,
      with each function and class commented out, for --imports.
  component-ui call <component.wasm> [<call>...] [options]
      Calls exports in order, on one instance, e.g. 'iface.func(1, "a")', 'new iface/res(1)'
      or 'iface/res.method(#borrow-res-1)', as the output shows them, with WAVE arguments;
      without calls, those of the answers file, its '> call' lines.
Options:
  --answers <file>        The answers file: '> call' lines, and answers to imports in the order
                          the guest calls them, 'iface.func(args) = <wave>'; repeatable
  --answer <answer>       One answer, after those of --answers; repeatable
  --save <file>           Writes the run as an answers file, which reproduces it; it may be the
                          --answers file. Where the run stopped, it writes the answer as '?'
  --defaults <level>      Answers past the file's last: 'eager' (the default) takes 'ok' and new
                          mocks, noting other instances; 'careful' stops where there are
                          instances to choose; 'none' stops at every import that asks
  --imports <pkg>=<file>  Implements an imported package, e.g. 'docs:adder/add=add.js', in JavaScript.
                          --save records its answers, marked '// javascript', which a replay
                          uses unless --imports implements the package again
  --from <line>           Prints the run from the import that used this answer, e.g.
                          'answers.txt:12' or '12' for the first --answers file; by default,
                          from the last answer used
  --all                   Prints the whole run
  --no-wasi-shim          Doesn't provide WASI from the preview2 shim, so that WASI imports ask
                          like any other: a run is then fully deterministic. A replay needs it:
                          the shim's answers that --save records, marked '// wasi', answer them.
                          Also for inspect and template
In values, '#mock' is a new mock of a host resource, and '#mock-x-2' a new mock that is to get the
id 'x-2', as --save writes them; a list<u8> of text may be written b"…".
Exits with 0 when all calls ran, 2 when an import needs an answer, 3 when a call failed, e.g.
trapped, and 1 on errors.`;

// The most frames of a trap to print.
const MAX_FRAMES = 20;

// Exit codes.
const FAILED = 1;
const NEEDS_ANSWER = 2;
const CALL_FAILED = 3;

class UsageError extends Error {}

// The types a type is built from that have names, e.g. an `enum` used in a `list`, by name.
function namedTypes(t: WIT.Type, found: Map<string, WIT.Type>) {
  if (t._typeName && !found.has(t._typeName)) {
    found.set(t._typeName, t);
  }
  if (t instanceof WIT.OptClass || t instanceof WIT.VecClass) {
    namedTypes(t._ty, found);
  } else if (t instanceof WIT.RecordClass || t instanceof WIT.VariantClass) {
    Object.values(t._fields).forEach((ty) => namedTypes(ty, found));
  } else if (t instanceof WIT.TupleClass) {
    t._components.forEach((ty) => namedTypes(ty, found));
  } else if (t instanceof WIT.RecClass && !(t.get_type() instanceof WIT.ResourceClass)) {
    namedTypes(t.get_type()!, found);
  }
}

// A function's signature as a call to it is written, e.g. `exports/x.get-a(self: borrow<x>) -> s32`.
function signature(callee: string, func: WIT.FuncClass, types: Map<string, WIT.Type>, resource?: WIT.ResourceClass): string {
  [...func._args.map(([_, ty]) => ty), ...func._ret].forEach((ty) => namedTypes(ty, types));
  const self = func.callKind === 'method' && resource ? [`self: borrow<${resource.witName}>`] : [];
  const ret = func._ret.length > 0 ? ` -> ${func._ret[0].name}` : '';
  return `${callee}(${[...self, ...func._args.map(([name, ty]) => `${name}: ${ty.name}`)].join(', ')})${ret}`;
}

// The functions of interfaces, as a call to them is written, with the resource of a method; of
// the resources `include` takes, e.g. those the interfaces define.
function functionsOf(
  interfaces: WIT.InterfaceClass[], include: (resource: WIT.ResourceClass, iface: WIT.InterfaceClass) => boolean = () => true, funcs = true,
): Array<[string, WIT.FuncClass, WIT.ResourceClass?]> {
  const found: Array<[string, WIT.FuncClass, WIT.ResourceClass?]> = [];
  const seen = new Set<WIT.ResourceClass>();
  for (const iface of interfaces) {
    if (funcs) {
      for (const [key, func] of Object.entries(iface._fields)) {
        found.push([qualified(iface._name, func.displayName(key)), func]);
      }
    }
    for (const resource of iface.get_resources().filter((r) => !seen.has(r) && include(r, iface))) {
      seen.add(resource);
      const name = qualifiedResource(resource);
      for (const [key, func] of Object.entries(resource._fields)) {
        found.push([func.callKind === 'constructor' ? `new ${name}` : `${name}.${func.displayName(key)}`, func, resource]);
      }
    }
  }
  return found;
}

async function inspect(file: string, wasiShim: boolean, print: (line: string) => void) {
  const component = await loadComponent(nodePlatform, await readFile(file), wasiShim);
  const types = new Map<string, WIT.Type>();
  const section = (title: string, funcs: Array<[string, WIT.FuncClass, WIT.ResourceClass?]>) => {
    if (funcs.length > 0) {
      print(title);
      funcs.forEach(([callee, func, resource]) => print(`  ${signature(callee, func, types, resource)}`));
    }
  };
  // The guest's resources, as the UI shows them: under the export that defines them, which others
  // may `use`. The rest are the host's, defined by imports.
  const defined = new Set(component.interfaces.flatMap(definedResources));
  section('Exports, which `call` calls:', functionsOf(component.interfaces, (r, iface) => definedResources(iface).includes(r)));
  section('Host resources the exports use, whose functions `call` can call too, e.g. to make their arguments:',
    functionsOf(component.interfaces, (r) => !defined.has(r), false));
  const custom = new Set(component.customImports.map(unversioned));
  const imported = functionsOf(component.imports.filter((iface) => custom.has(unversioned(iface._name))));
  const asks = (func: WIT.FuncClass) => func._ret.length > 0 && func.callKind !== 'constructor';
  section('Imports that ask for answers, unless implemented with --imports:', imported.filter(([_, func]) => asks(func)));
  section('Imports answered on their own, with a new mock for a constructor, and nothing for a function without a result:',
    imported.filter(([_, func]) => !asks(func)));
  if (component.customImports.length > 0) {
    print(`Packages to implement with --imports: ${component.customImports.join(', ')}`);
  }
  print(types.size > 0 ? 'Types:' : 'Types: none');
  for (const [name, ty] of types) {
    print(`  ${name} = ${ty.expr}`);
  }
}

// A line the run prints. `source` is where the answer of its import came from, and `header`
// marks the first line of a call.
interface RunLine {
  text: string;
  source?: string;
  header?: boolean;
}

function outputLines(stream: StreamEntry['stream'], text: string, indent: string): RunLine[] {
  const lines = text.replace(/\n$/, '').split('\n');
  // Without the colors of the guest's logs; this isn't a terminal's output.
  return lines.map((line) => ({ text: `${indent}[${stream}] ${line.replace(/\x1b\[[0-9;]*m/g, '')}` }));
}

// A write to stdout or stderr, by its place in the log.
interface Write {
  kind: 'write';
  seq: number;
  stream: StreamEntry['stream'];
  text: string;
}

// How a call or an import ended: its result, e.g. `= 3`, or error and the guest's frames, marked
// with who answered it, e.g. `(answers.txt:1)`; `shown` is its value as the answers file writes
// it, e.g. with new mocks as `#mock-x-2`.
function endingLines(entry: CallEntry | ImportEntry, by: Answer | undefined, shown?: string): string[] {
  if (entry.status === 'pending') {
    return [];
  }
  const marked = (line: string) => (by ? `${line}  (${[by.source, by.note].filter(Boolean).join('; ')})` : line);
  if (entry.status === 'ok') {
    return [marked(`= ${shown ?? (entry.output === '' ? '()' : entry.output)}`)];
  }
  const frames = entry.frames.slice(0, MAX_FRAMES).map((frame) => `  at ${frame}`);
  const more = entry.frames.length > MAX_FRAMES ? [`  … ${entry.frames.length - MAX_FRAMES} more frames`] : [];
  return [marked(`! ${entry.output}`), ...frames, ...more];
}

// An import, e.g. `↳ add(1, 2)` and `= 3  (answers.txt:1)`; still asking, `? u32`.
function importLines(entry: ImportEntry, indent: string): RunLine[] {
  const by = entry.answered?.by;
  const lines = [
    ...(entry.note ? [`~ ${entry.note}`] : []),
    ...(entry.prompt ? [`? ${entry.prompt.type.name}`] : []),
    ...endingLines(entry, by, answeredValue(entry)),
    ...(entry.detail === undefined ? [] : entry.detail.split('\n').map((line) => `| ${line}`)),
  ];
  return [{ text: `${indent}↳ ${entry.record.label}`, source: by?.source }, ...lines.map((text) => ({ text: `${indent}  ${text}` }))];
}

// The run as the console shows it, e.g. `› f(1)`, `  ↳ g(1)` for an import, then `  = 2`: each
// import under the call that made it, with the output written meanwhile, in order.
function runLines(log: CallLog): RunLine[] {
  const lines: RunLine[] = [];
  for (const entry of log.entries) {
    if (entry.kind === 'stream') {
      if (!entry.call) {
        lines.push(...outputLines(entry.stream, entry.text, ''));
      }
    } else if (entry.kind === 'import') {
      lines.push(...importLines(entry, ''));
    } else {
      lines.push({ text: `› ${entry.label}`, header: true });
      // The writes where they happened, e.g. among the WASI calls that wrote them; those with
      // nothing logged in between print together.
      const writes = log.entries.filter((e): e is StreamEntry => e.kind === 'stream' && e.call === entry)
        .flatMap((e) => e.writes.map((w): Write => ({ kind: 'write', stream: e.stream, ...w })));
      const children = [...entry.imports, ...writes].sort((a, b) => a.seq - b.seq);
      let own: ImportEntry | undefined;
      children.forEach((child, i) => {
        const next = children[i + 1];
        if (child.kind === 'write') {
          if (next?.kind === 'write' && next.stream === child.stream) {
            next.text = child.text + next.text;
          } else {
            lines.push(...outputLines(child.stream, child.text, '  '));
          }
        } else if (isOwnCall(entry, child)) {
          // Shown as the call itself, with what an import shows of it, e.g. the response it sent.
          own = child;
          if (child.note) {
            lines.push({ text: `  ~ ${child.note}` });
          }
          if (child.prompt) {
            lines.push({ text: `  ? ${child.prompt.type.name}` });
          }
        } else {
          lines.push(...importLines(child, '  '));
        }
      });
      const by = own?.answered?.by;
      lines.push(...endingLines(entry, by, own && answeredValue(own)).map((text, i) => ({ text: `  ${text}`, source: i === 0 ? by?.source : undefined })));
      lines.push(...(own?.detail === undefined ? [] : own.detail.split('\n').map((line) => ({ text: `  | ${line}` }))));
    }
  }
  return lines;
}

// Prints the run from the import that used the answer from `from`, under the line of the call
// that made it, or all of it.
function printRun(lines: RunLine[], print: (line: string) => void, from?: string) {
  const start = from === undefined ? -1 : lines.findIndex((line) => line.source === from);
  if (start <= 0) {
    lines.forEach((line) => print(line.text));
    return;
  }
  let header = start;
  while (header > 0 && !lines[header].header) {
    header--;
  }
  const kept = lines[header].header && header < start ? [lines[header]] : [];
  const skipped = start - kept.length;
  kept.forEach((line) => print(line.text));
  print(`${kept.length > 0 ? '  ' : ''}… ${skipped} earlier line${skipped === 1 ? '' : 's'}; --all prints them`);
  lines.slice(start).forEach((line) => print(line.text));
}

// The hint at a stop: the type the answer must have, the named types it uses, and the instances
// it could use, e.g. `instances of backend: #backend-4 (from …)`.
function stopHint(driver: Driver, stopped: Stopped, hole: string | undefined): string[] {
  const [type] = stopped.func._ret;
  const types = new Map<string, WIT.Type>();
  namedTypes(type, types);
  // Where the instances the call takes came from, e.g. the backend whose name it asks for.
  const given = new Set<string>();
  stopped.record.args.forEach((arg) => mapHandles(arg, (label) => {
    given.add(label.replace(/^borrow-/, ''));
    return label;
  }));
  const instances = [...given].flatMap((id) => {
    const instance = driver.registry.instance(id);
    return instance ? [describeInstance(instance)] : [];
  });
  const origins = instances.length > 0 ? [`  the call takes ${instances.join(', ')}`] : [];
  return [
    `  expects ${type.name}`,
    ...[...types].map(([name, ty]) => `    ${name} = ${ty.expr}`),
    ...origins,
    ...driver.instancesFor([type], 'host').map((line) => `  ${line}`),
    ...(hole
      ? [`  replace the ? at ${hole} with the answer, and run again`]
      : ['  add the answer to the answers, e.g.:', `    ${stopped.record.label} = <${type.name}>`]),
  ];
}

// Whether an answer's callee, e.g. `new imports/y` or `docs:adder/add@0.1.0.add`, is of the
// imported package, e.g. `docs:adder/add`, with or without its version.
function isOfPackage(callee: string, pkg: string): boolean {
  const name = callee.replace(/^new /, '');
  const unversionedPkg = unversioned(pkg);
  return name.startsWith(unversionedPkg) && /^[/@.]/.test(name.slice(unversionedPkg.length));
}

// Where an answer comes from, as `--from` names it: `answers.txt:12`, or `12` in the first file.
function fromSource(from: string, files: string[]): string {
  return /^\d+$/.test(from) && files.length > 0 ? `${files[0]}:${from}` : from;
}

async function callCommand(file: string, argCalls: string[], values: Record<string, any>, print: (line: string) => void): Promise<number> {
  const level: DefaultsLevel = values.defaults ?? 'eager';
  if (!DEFAULTS_LEVELS.includes(level)) {
    throw new UsageError(`Expected --defaults ${DEFAULTS_LEVELS.join(', ')}, got ${level}`);
  }
  const files: string[] = values.answers ?? [];
  const lines: ScriptLine[] = [];
  for (const answers of files) {
    lines.push(...parseScript(await readFile(answers, 'utf8'), answers));
  }
  (values.answer ?? []).forEach((answer: string, i: number) => lines.push(parseAnswer(answer, `--answer ${i + 1}`)));
  const importCode: Record<string, string> = {};
  for (const option of values.imports ?? []) {
    const eq = option.lastIndexOf('=');
    if (eq < 0) {
      throw new UsageError(`Expected --imports <pkg>=<file>, got ${option}`);
    }
    importCode[option.slice(0, eq)] = await readFile(option.slice(eq + 1), 'utf8');
  }
  const wasiShim = !values['no-wasi-shim'];
  // The answers recorded from the JavaScript of --imports, which runs again, answer nothing.
  const runsAgain = (line: ScriptLine) => line.kind === 'answer' && line.recorded === 'javascript'
    && Object.keys(importCode).some((pkg) => isOfPackage(line.callee, pkg));
  const kept = lines.filter((line) => !runsAgain(line));
  const script = new Script(kept, level);
  // The calls: those of the command line, or of the file, which must be the same if both have them.
  const fileCalls = script.calls;
  if (argCalls.length > 0 && fileCalls.length > 0 && argCalls.join('\n') !== fileCalls.map((line) => line.call).join('\n')) {
    throw new UsageError(`The calls differ from those of the answers, ${fileCalls.map((line) => line.call).join(', ')}; give either`);
  }
  const calls = fileCalls.length > 0 ? fileCalls.map((line) => ({ text: line.call, line })) : argCalls.map((text) => ({ text, line: undefined }));
  if (calls.length === 0) {
    throw new UsageError('Give at least one call, on the command line or as `> call` lines of the answers');
  }
  const header = scriptHeader(`component-ui call ${file} --defaults ${level}${wasiShim ? '' : ' --no-wasi-shim'}`, implementedImports(importCode), wasiShim);
  const driver = await Driver.start(nodePlatform, await readFile(file), script, importCode, wasiShim);
  for (const custom of Object.keys(importCode).filter((pkg) => !driver.component.customImports.includes(pkg))) {
    throw new UsageError(`The component imports no ${custom}; it imports ${driver.component.customImports.join(', ')}`);
  }
  // The answers recorded from the shim would never be used with it, as it answers those calls
  // itself: a replay answers WASI without the shim. Other answers for WASI may answer the calls
  // that ask with the shim too, e.g. a mock's.
  const wasi = wasiShim && kept.find((line): line is AnswerLine => line.kind === 'answer' && line.recorded === 'wasi');
  if (wasi) {
    throw new UsageError(`${wasi.source}: answers ${wasi.callee} as the WASI shim did; replay with --no-wasi-shim`);
  }
  let stopped: Stopped | undefined;
  // Why the run stopped where the guest's calls differ from the answers, e.g. after an edit.
  let diverged: string | undefined;
  let ran = 0;
  // The file's lines of the calls made, for their comments.
  const callLines: Array<CallLine | undefined> = [];
  // A call that failed, e.g. trapped, leaving answers it would have used: that is why the run
  // differs from the file, not a change of the guest's calls.
  let failed: CallEntry | undefined;
  // The WASI the shim provides, which answers its calls itself, but not those that ask, e.g. a mock's.
  const shimmed = driver.component.transpiled.imports.filter((pkg) => !driver.component.customImports.includes(pkg));
  const diverge = (err: unknown) => {
    const line = err instanceof Divergence ? err.line : undefined;
    if (wasiShim && line?.kind === 'answer' && shimmed.some((pkg) => isOfPackage(line.callee, pkg))) {
      diverged = `${line.source}: no import asked for this answer to ${line.callee}, which the WASI shim may have answered itself; `
        + 'if the file was saved with --no-wasi-shim, run with it again.';
      failed = undefined;
    } else if (failed && line) {
      diverged = `${failed.label} failed, with ${failed.output}, before using the answers from ${line.source} on. `
        + 'Fix the answer that made it fail, e.g. the last it used, or remove the answers it didn\'t use, and run again.';
    } else {
      diverged = (err as Error).message;
      failed = undefined;
    }
  };
  for (const { text, line } of calls) {
    try {
      script.beginCall(text);
    } catch (err) {
      diverge(err);
      break;
    }
    callLines.push(line);
    ran++;
    const before = driver.lastFailure();
    stopped = await driver.run(text);
    failed = driver.lastFailure() !== before ? driver.lastFailure() : undefined;
    if (stopped) {
      break;
    }
  }
  if (!stopped && !diverged && ran === calls.length) {
    try {
      script.finish();
    } catch (err) {
      diverge(err);
    }
  }
  const scriptOptions = { header, callLines, rest: calls.slice(ran) };
  const from = values.all ? undefined : values.from !== undefined ? fromSource(values.from, files) : script.lastUsed?.source;
  printRun(runLines(driver.log), print, from);
  // The imports whose JavaScript wasn't called, as an argument was a mock, which their notes say.
  const imports = driver.log.entries.flatMap((e) => (e.kind === 'call' ? e.imports : e.kind === 'import' ? [e] : []));
  const skipped = new Set(imports.filter((entry) => entry.note !== undefined).map((entry) => entry.record.callee));
  if (skipped.size > 0) {
    print(`warning: your JavaScript of ${[...skipped].join(', ')} wasn't called where an argument was a mock; those calls asked for answers instead`);
  }
  const saved = values.save && !diverged && (!stopped || stopped.unanswered);
  if (saved) {
    await writeFile(values.save, writeScript(driver.log, scriptOptions));
  }
  if (diverged || (stopped && !stopped.unanswered)) {
    print(`stopped: ${diverged ?? stopped!.reason}`);
    return diverged && failed ? CALL_FAILED : FAILED;
  }
  if (stopped) {
    print(`stopped: ${stopped.reason}`);
    const hole = saved ? scriptLines(driver.log, scriptOptions).findIndex((line) => line.hole) + 1 || undefined : undefined;
    stopHint(driver, stopped, hole === undefined ? undefined : `${values.save}:${hole}`).forEach((line) => print(line));
    return NEEDS_ANSWER;
  }
  return driver.lastFailure() ? CALL_FAILED : 0;
}

// Prints the JavaScript template for an imported package, as the UI's editor starts with it.
async function template(file: string, pkg: string | undefined, wasiShim: boolean, print: (line: string) => void) {
  const component = await loadComponent(nodePlatform, await readFile(file), wasiShim);
  if (!pkg || !component.customImports.includes(pkg)) {
    throw new UsageError(`Give a package to implement: ${component.customImports.join(', ') || 'the component imports none'}`);
  }
  print(importTemplate(byImportName(component.imports).get(unversioned(pkg)) ?? [], 'from the answers'));
}

async function main(argv: string[], print: (line: string) => void = console.log): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      answers: { type: 'string', multiple: true },
      answer: { type: 'string', multiple: true },
      save: { type: 'string' },
      defaults: { type: 'string' },
      imports: { type: 'string', multiple: true },
      from: { type: 'string' },
      all: { type: 'boolean' },
      'no-wasi-shim': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, file, ...calls] = positionals;
  if (values.help) {
    print(USAGE);
    return 0;
  }
  if (!file || !['inspect', 'template', 'call'].includes(command)) {
    throw new UsageError(command ? `Unknown command ${command}` : 'Give a command');
  }
  if (command === 'inspect') {
    await inspect(file, !values['no-wasi-shim'], print);
    return 0;
  }
  if (command === 'template') {
    await template(file, calls[0], !values['no-wasi-shim'], print);
    return 0;
  }
  return callCommand(file, calls, values, print);
}

// Imports wait for answers with JSPI, which Node 23 and 24 enable with a flag.
function rerunWithJspi(): number {
  const result = spawnSync(process.execPath, ['--experimental-wasm-jspi', ...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, COMPONENT_UI_JSPI: '1' },
  });
  return result.status ?? FAILED;
}

async function run() {
  // The guest's frames of a trap come after those of its runtime, e.g. Rust's panic handling.
  Error.stackTraceLimit = 200;
  if (!JSPI_SUPPORTED) {
    if (process.env.COMPONENT_UI_JSPI) {
      console.error('This Node has no JSPI (WebAssembly.Suspending); use Node 23 or later.');
      process.exit(FAILED);
    }
    process.exit(rerunWithJspi());
  }
  let code: number;
  try {
    code = await main(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : err}`);
    if (err instanceof UsageError || (err as any)?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      console.error(`\n${USAGE}`);
    }
    code = FAILED;
  }
  // A run that stopped leaves the guest waiting on an import; don't wait for it.
  process.exit(code);
}

void run();
