import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import * as WIT from './wit';
import { qualified, qualifiedResource, unversioned } from './call-record';
import { SequenceAnswers, parseAnswer, parseAnswers, AnswerEntry } from './answers';
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
// `--answer`, in the order the guest calls them (see src/answers.ts). A run stops at the first
// import without an answer, which it reports with the type of value it expects.

const USAGE = `Usage:
  component-ui inspect <component.wasm>
      Shows the exports to call, the imports that ask for answers, and the types they use.
  component-ui call <component.wasm> <call>... [options]
      Calls exports in order, on one instance, e.g. 'iface.func(1, "a")', 'new iface/res(1)'
      or '#borrow-res-1.method()', written as the output shows them; arguments are WAVE.
Options:
  --answers <file>        Answers to imports, one per line: 'iface.func = <wave>'; repeatable
  --answer <answer>       One answer, after those of --answers; repeatable
  --imports <pkg>=<file>  Implements an imported package, e.g. 'docs:adder/add=add.js', in JavaScript
  --json                  Prints events as JSON lines
Exits with 0 when all calls ran, 2 when an import needs an answer, and 1 on errors.`;

// Exit codes.
const NEEDS_ANSWER = 2;
const FAILED = 1;

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

function signature(callee: string, func: WIT.FuncClass, types: Map<string, WIT.Type>): string {
  [...func._args.map(([_, ty]) => ty), ...func._ret].forEach((ty) => namedTypes(ty, types));
  const ret = func._ret.length > 0 ? ` -> ${func._ret[0].name}` : '';
  return `${callee}(${func._args.map(([name, ty]) => `${name}: ${ty.name}`).join(', ')})${ret}`;
}

// The functions of interfaces, as the console shows calls to them; methods on a placeholder
// instance, e.g. `#borrow-x-N.get-a`.
function functionsOf(interfaces: WIT.InterfaceClass[]): Array<[string, WIT.FuncClass]> {
  const funcs: Array<[string, WIT.FuncClass]> = [];
  const seen = new Set<WIT.ResourceClass>();
  for (const iface of interfaces) {
    funcs.push(...Object.entries(iface._fields).map(([key, func]): [string, WIT.FuncClass] => [qualified(iface._name, func.displayName(key)), func]));
    for (const resource of iface.get_resources().filter((r) => !seen.has(r))) {
      seen.add(resource);
      const name = qualifiedResource(resource);
      for (const [key, func] of Object.entries(resource._fields)) {
        const callee = func.callKind === 'constructor' ? `new ${name}`
          : func.callKind === 'method' ? `#borrow-${resource.witName}-N.${func.displayName(key)}` : `${name}.${func.displayName(key)}`;
        funcs.push([callee, func]);
      }
    }
  }
  return funcs;
}

async function inspect(file: string, print: (line: string) => void) {
  const component = await loadComponent(nodePlatform, await readFile(file));
  const types = new Map<string, WIT.Type>();
  print('Exports, which `call` calls; methods are called on an instance, e.g. #borrow-x-1.get-a():');
  for (const [callee, func] of functionsOf(component.interfaces)) {
    print(`  ${signature(callee, func, types)}`);
  }
  const custom = new Set(component.customImports.map(unversioned));
  const asking = functionsOf(component.imports.filter((iface) => custom.has(unversioned(iface._name))))
    .filter(([_, func]) => func._ret.length > 0);
  if (asking.length > 0) {
    print('Imports that ask for answers, unless implemented with --imports:');
    for (const [callee, func] of asking) {
      print(`  ${signature(callee, func, types)}`);
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

// Prints events as the console shows them, e.g. `› f(1)`, `  ↳ g(1)` for an import, then `  = 2`.
class TextOutput {
  // Output not yet ending in a newline, by stream.
  private readonly pending = { stdout: '', stderr: '' };

  constructor(private readonly print: (line: string) => void) {}

  public event(event: DriverEvent) {
    if (event.type === 'output') {
      const lines = (this.pending[event.stream] + event.text).split('\n');
      this.pending[event.stream] = lines.pop()!;
      lines.forEach((line) => this.print(`[${event.stream}] ${line}`));
      return;
    }
    this.flush();
    const indent = event.record.kind === 'import' ? '    ' : '  ';
    switch (event.type) {
      case 'call':
        this.print(event.record.kind === 'import' ? `  ↳ ${event.record.label}` : `› ${event.record.label}`);
        break;
      case 'ask':
        this.print(`${indent}? ${event.expects}`);
        break;
      case 'result':
        this.print(`${indent}= ${event.text === '' ? '()' : event.text}`);
        break;
      case 'error':
        this.print(`${indent}! ${event.text}`);
        break;
      case 'detail':
        event.text.split('\n').forEach((line) => this.print(`${indent}| ${line}`));
        break;
    }
  }

  public flush() {
    for (const stream of ['stdout', 'stderr'] as const) {
      if (this.pending[stream] !== '') {
        this.print(`[${stream}] ${this.pending[stream]}`);
        this.pending[stream] = '';
      }
    }
  }

  public stopped(stopped: Stopped, answered: number) {
    this.flush();
    this.print(`stopped: ${stopped.reason}`);
    if (stopped.unanswered) {
      const [callee] = stopped.record.label.split('(');
      this.print(`  answer ${answered + 1} is needed, e.g. --answer '${callee} = <${stopped.expects}>'`);
    }
  }

  public unused(entries: AnswerEntry[]) {
    if (entries.length > 0) {
      this.print(`warning: ${entries.length} answer${entries.length === 1 ? ' was' : 's were'} not used, from ${entries[0].source}`);
    }
  }
}

async function callCommand(file: string, calls: string[], values: Record<string, any>, print: (line: string) => void): Promise<number> {
  if (calls.length === 0) {
    throw new UsageError('Give at least one call');
  }
  const entries: AnswerEntry[] = [];
  for (const answers of values.answers ?? []) {
    entries.push(...parseAnswers(await readFile(answers, 'utf8'), answers));
  }
  (values.answer ?? []).forEach((answer: string, i: number) => entries.push(parseAnswer(answer, `--answer ${i + 1}`)));
  const importCode: Record<string, string> = {};
  for (const option of values.imports ?? []) {
    const eq = option.lastIndexOf('=');
    if (eq < 0) {
      throw new UsageError(`Expected --imports <pkg>=<file>, got ${option}`);
    }
    importCode[option.slice(0, eq)] = await readFile(option.slice(eq + 1), 'utf8');
  }
  const answers = new SequenceAnswers(entries);
  const text = new TextOutput(print);
  const json = (value: object) => print(JSON.stringify(value));
  const onEvent = (event: DriverEvent) => (values.json ? json(event) : text.event(event));
  const driver = await Driver.start(nodePlatform, await readFile(file), onEvent, answers, importCode);
  for (const custom of Object.keys(importCode).filter((pkg) => !driver.component.customImports.includes(pkg))) {
    throw new UsageError(`The component imports no ${custom}; it imports ${driver.component.customImports.join(', ')}`);
  }
  for (const call of calls) {
    const stopped = await driver.run(call);
    if (stopped) {
      const answered = entries.length - answers.unused.length;
      if (values.json) {
        json({ type: 'stopped', ...stopped, answered });
      } else {
        text.stopped(stopped, answered);
      }
      return stopped.unanswered ? NEEDS_ANSWER : FAILED;
    }
  }
  if (values.json) {
    json({ type: 'done', unused: answers.unused });
  } else {
    text.flush();
    text.unused(answers.unused);
  }
  return 0;
}

async function main(argv: string[], print: (line: string) => void = console.log): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      answers: { type: 'string', multiple: true },
      answer: { type: 'string', multiple: true },
      imports: { type: 'string', multiple: true },
      json: { type: 'boolean' },
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
