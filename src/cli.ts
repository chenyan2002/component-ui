import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import * as WIT from './wit';
import { CallRecord, qualified, qualifiedResource, unversioned } from './call-record';
import { DEFAULTS_LEVELS, DefaultsLevel, parseAnswer, parseScript, Script, ScriptLine, ScriptRecorder } from './answers';
import { Driver, DriverEvent, Stopped } from './driver';
import { JSPI_SUPPORTED, loadComponent } from './loader';
import { nodePlatform } from './platform-node';

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
  --imports <pkg>=<file>  Implements an imported package, e.g. 'docs:adder/add=add.js', in JavaScript
  --from <line>           Prints the run from the import that used this answer, e.g.
                          'answers.txt:12' or '12' for the first --answers file; by default,
                          from the last answer used
  --all                   Prints the whole run
In values, '#mock' is a new mock of a host resource, and '#mock-x-2' a new mock that is to get the
id 'x-2', as --save writes them; a list<u8> of text may be written b"…".
Exits with 0 when all calls ran, 2 when an import needs an answer, 3 when a call failed, e.g.
trapped, and 1 on errors.`;

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

// The functions of interfaces, as a call to them is written, with the resource of a method.
function functionsOf(interfaces: WIT.InterfaceClass[]): Array<[string, WIT.FuncClass, WIT.ResourceClass?]> {
  const funcs: Array<[string, WIT.FuncClass, WIT.ResourceClass?]> = [];
  const seen = new Set<WIT.ResourceClass>();
  for (const iface of interfaces) {
    for (const [key, func] of Object.entries(iface._fields)) {
      funcs.push([qualified(iface._name, func.displayName(key)), func]);
    }
    for (const resource of iface.get_resources().filter((r) => !seen.has(r))) {
      seen.add(resource);
      const name = qualifiedResource(resource);
      for (const [key, func] of Object.entries(resource._fields)) {
        funcs.push([func.callKind === 'constructor' ? `new ${name}` : `${name}.${func.displayName(key)}`, func, resource]);
      }
    }
  }
  return funcs;
}

async function inspect(file: string, print: (line: string) => void) {
  const component = await loadComponent(nodePlatform, await readFile(file));
  const types = new Map<string, WIT.Type>();
  print('Exports, which `call` calls:');
  for (const [callee, func, resource] of functionsOf(component.interfaces)) {
    print(`  ${signature(callee, func, types, resource)}`);
  }
  const custom = new Set(component.customImports.map(unversioned));
  const asking = functionsOf(component.imports.filter((iface) => custom.has(unversioned(iface._name))))
    .filter(([_, func]) => func._ret.length > 0);
  if (asking.length > 0) {
    print('Imports that ask for answers, unless implemented with --imports:');
    for (const [callee, func, resource] of asking) {
      print(`  ${signature(callee, func, types, resource)}`);
    }
    print(`Packages to implement with --imports: ${component.customImports.join(', ')}`);
  }
  if (types.size > 0) {
    print('Types:');
    for (const [name, ty] of types) {
      print(`  ${name} = ${ty.expr}`);
    }
  }
}

// An import the guest called, as the run shows it.
interface ImportNode {
  kind: 'import';
  record: CallRecord;
  lines: string[];
  // Where its answer came from, e.g. `answers.txt:3` or `default`, and what more to say, e.g.
  // which instances the happy path passed over.
  source?: string;
  note?: string;
}

// A call the run made, with the imports it called and the output it wrote.
interface CallNode {
  kind: 'call';
  record: CallRecord;
  children: Array<ImportNode | OutputNode>;
  lines: string[];
  // Where the answer came from of the import that is the call itself, when it calls the host.
  source?: string;
  note?: string;
}

interface OutputNode {
  kind: 'output';
  stream: 'stdout' | 'stderr';
  text: string;
}

// Collects a run's events as the console shows them: each import under the call that made it,
// with its answer's source, e.g. `= 3  (answers.txt:1)`, and prints them once the run is over.
class Run {
  private readonly nodes: Array<CallNode | ImportNode | OutputNode> = [];

  // `shown` gives an answered import's value as `--save` writes it.
  constructor(private readonly shown: (record: CallRecord) => string | undefined) {}

  private readonly imports = new Map<CallRecord, ImportNode>();
  private current?: CallNode;

  public event(event: DriverEvent) {
    if (event.type === 'output') {
      const parent = this.current?.children ?? this.nodes;
      const last = parent.at(-1);
      if (last?.kind === 'output' && last.stream === event.stream) {
        last.text += event.text;
      } else {
        parent.push({ kind: 'output', stream: event.stream, text: event.text });
      }
      return;
    }
    if (event.type === 'instance') {
      return;
    }
    const { record } = event;
    if (event.type === 'call') {
      if (record.kind === 'import') {
        const node: ImportNode = { kind: 'import', record, lines: [] };
        this.imports.set(record, node);
        (this.current?.children ?? this.nodes).push(node);
      } else {
        this.current = { kind: 'call', record, children: [], lines: [] };
        this.nodes.push(this.current);
      }
      return;
    }
    const node = record.kind === 'import' ? this.imports.get(record) : this.callNode(record);
    if (!node) {
      return;
    }
    switch (event.type) {
      case 'ask':
        node.lines.push(`? ${event.expects}`);
        break;
      case 'answer':
        node.source = event.answer.source;
        node.note = event.answer.note;
        node.lines = node.lines.filter((line) => !line.startsWith('? '));
        break;
      case 'result':
        node.lines.push(`= ${event.text === '' ? '()' : event.text}`);
        break;
      case 'error':
        node.lines.push(`! ${event.text}`);
        break;
      case 'detail':
        node.lines.push(...event.text.split('\n').map((line) => `| ${line}`));
        break;
    }
  }

  private callNode(record: CallRecord): CallNode | undefined {
    return this.nodes.find((n): n is CallNode => n.kind === 'call' && n.record === record);
  }

  // The import that is a call of the UI's to the host itself, e.g. a mock's method, which asks:
  // the console shows only its answer, under the call.
  private isSelf(call: CallNode, node: ImportNode): boolean {
    return call.record.kind === 'host' && node.record.label === call.record.label;
  }

  private outputLines(node: OutputNode, indent: string): string[] {
    const lines = node.text.replace(/\n$/, '').split('\n');
    // Without the colors of the guest's logs; this isn't a terminal's output.
    return lines.map((line) => `${indent}[${node.stream}] ${line.replace(/\x1b\[[0-9;]*m/g, '')}`);
  }

  private importLines(node: ImportNode, indent: string): string[] {
    return [`${indent}↳ ${node.record.label}`, ...this.answered(node.lines, node).map((line) => `${indent}  ${line}`)];
  }

  // Marks the result of an answered import with where its answer came from, and shows it as
  // `--save` writes it, with new mocks as `#mock-x-2`, e.g. `= ok(#mock-x-2)  (default)`.
  private answered(lines: string[], node?: ImportNode): string[] {
    const result = lines.findIndex((line) => line.startsWith('= ') || line.startsWith('! '));
    if (!node?.source || result < 0) {
      return lines;
    }
    const shown = this.shown(node.record);
    const line = shown !== undefined && lines[result].startsWith('= ') ? `= ${shown}` : lines[result];
    const marked = `${line}  (${[node.source, node.note].filter(Boolean).join('; ')})`;
    return lines.map((l, i) => (i === result ? marked : l));
  }

  // The lines of the run, each import's and the result of a call that asks marked with where
  // its answer came from, so that printing can start there.
  private render(): RunLine[] {
    const lines: RunLine[] = [];
    for (const node of this.nodes) {
      if (node.kind === 'output') {
        lines.push(...this.outputLines(node, '').map((text) => ({ text })));
      } else if (node.kind === 'import') {
        lines.push(...this.importLines(node, '').map((text, i) => ({ text, source: i === 0 ? node.source : undefined })));
      } else {
        lines.push({ text: `› ${node.record.label}`, header: true });
        let own: ImportNode | undefined;
        for (const child of node.children) {
          if (child.kind === 'output') {
            lines.push(...this.outputLines(child, '  ').map((text) => ({ text })));
          } else if (this.isSelf(node, child)) {
            own = child;
            lines.push(...child.lines.filter((line) => line.startsWith('? ')).map((line) => ({ text: `  ${line}` })));
          } else {
            lines.push(...this.importLines(child, '  ').map((text, i) => ({ text, source: i === 0 ? child.source : undefined })));
          }
        }
        lines.push(...this.answered(node.lines, own).map((line, i) => ({ text: `  ${line}`, source: i === 0 ? own?.source : undefined })));
      }
    }
    return lines;
  }

  // Prints the run from the import that used the answer from `from`, under the line of the call
  // that made it, or all of it.
  public print(print: (line: string) => void, from?: string) {
    const lines = this.render();
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
}

// A line the run prints. `source` is where the answer of its import came from, and `header`
// marks the first line of a call.
interface RunLine {
  text: string;
  source?: string;
  header?: boolean;
}

// The hint at a stop: the type the answer must have, the named types it uses, and the instances
// it could use, e.g. `instances of backend: #backend-4 (from …)`.
function stopHint(driver: Driver, stopped: Stopped, hole: string | undefined): string[] {
  const [type] = stopped.func._ret;
  const types = new Map<string, WIT.Type>();
  namedTypes(type, types);
  return [
    `  expects ${type.name}`,
    ...[...types].map(([name, ty]) => `    ${name} = ${ty.expr}`),
    ...driver.instancesFor([type], 'host').map((line) => `  ${line}`),
    ...(hole
      ? [`  replace the ? at ${hole} with the answer, and run again`]
      : ['  add the answer to the answers, e.g.:', `    ${stopped.record.label} = <${type.name}>`]),
  ];
}

// Where an answer comes from, as `--from` names it: `answers.txt:12`, or `12` in the first file.
function fromSource(from: string, files: string[]): string {
  return /^\d+$/.test(from) && files.length > 0 ? `${files[0]}:${from}` : from;
}

// The ids of all the instances there have been.
function instanceIds(driver: Driver): Set<string> {
  return new Set(driver.registry.rows().flatMap((slot) => [slot.current, ...slot.earlier]).map((instance) => instance.id));
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
  const script = new Script(lines, level);
  // The calls: those of the command line, or of the file, which must be the same if both have them.
  const fileCalls = script.calls;
  if (argCalls.length > 0 && fileCalls.length > 0 && argCalls.join('\n') !== fileCalls.map((line) => line.call).join('\n')) {
    throw new UsageError(`The calls differ from those of the answers, ${fileCalls.map((line) => line.call).join(', ')}; give either`);
  }
  const calls = fileCalls.length > 0 ? fileCalls.map((line) => ({ text: line.call, line })) : argCalls.map((text) => ({ text, line: undefined }));
  if (calls.length === 0) {
    throw new UsageError('Give at least one call, on the command line or as `> call` lines of the answers');
  }
  const importCode: Record<string, string> = {};
  for (const option of values.imports ?? []) {
    const eq = option.lastIndexOf('=');
    if (eq < 0) {
      throw new UsageError(`Expected --imports <pkg>=<file>, got ${option}`);
    }
    importCode[option.slice(0, eq)] = await readFile(option.slice(eq + 1), 'utf8');
  }
  const header = [
    `//! component-ui call ${file} --defaults ${level}`,
    `//! imports implemented in JavaScript, whose calls aren't recorded: ${Object.keys(importCode).join(', ') || 'none'}`,
    '//! WASI comes from the shim and isn\'t recorded; a run may differ where the guest uses it, e.g. its clocks or random numbers',
  ];
  let driver: Driver | undefined;
  const recorder = new ScriptRecorder(header, () => (driver ? instanceIds(driver) : new Set()));
  const log = new Run((record) => recorder.valueOf(record));
  driver = await Driver.start(nodePlatform, await readFile(file), (event) => {
    log.event(event);
    recorder.event(event);
  }, script, importCode);
  for (const custom of Object.keys(importCode).filter((pkg) => !driver!.component.customImports.includes(pkg))) {
    throw new UsageError(`The component imports no ${custom}; it imports ${driver.component.customImports.join(', ')}`);
  }
  let stopped: Stopped | undefined;
  // Why the run stopped where the guest's calls differ from the answers, e.g. after an edit.
  let diverged: string | undefined;
  let ran = 0;
  for (const { text, line } of calls) {
    try {
      script.beginCall(text);
    } catch (err) {
      diverged = (err as Error).message;
      break;
    }
    recorder.beginCall(text, line);
    ran++;
    stopped = await driver.run(text);
    if (stopped) {
      break;
    }
  }
  if (!stopped && !diverged && ran === calls.length) {
    try {
      script.finish();
    } catch (err) {
      diverged = (err as Error).message;
    }
  }
  if (stopped?.unanswered) {
    recorder.hole(stopped.record, stopped.func._ret[0]);
  }
  recorder.rest(calls.slice(ran));
  const from = values.all ? undefined : values.from !== undefined ? fromSource(values.from, files) : script.lastUsed?.source;
  log.print(print, from);
  const saved = values.save && !diverged && (!stopped || stopped.unanswered);
  if (saved) {
    await writeFile(values.save, recorder.text());
  }
  if (diverged || (stopped && !stopped.unanswered)) {
    print(`stopped: ${diverged ?? stopped!.reason}`);
    return FAILED;
  }
  if (stopped) {
    print(`stopped: ${stopped.reason}`);
    const hole = saved ? recorder.holeLine() : undefined;
    stopHint(driver, stopped, hole === undefined ? undefined : `${values.save}:${hole}`).forEach((line) => print(line));
    return NEEDS_ANSWER;
  }
  return driver.failed ? CALL_FAILED : 0;
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
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, file, ...calls] = positionals;
  if (values.help) {
    print(USAGE);
    return 0;
  }
  if (!file || (command !== 'inspect' && command !== 'call')) {
    throw new UsageError(command ? `Unknown command ${command}` : 'Give a command');
  }
  if (command === 'inspect') {
    await inspect(file, print);
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
