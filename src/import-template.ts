import * as WIT from './wit';

// Reserved words a WIT name can turn into, which can't name a JS function or parameter.
const RESERVED = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import',
  'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public',
  'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'yield',
]);

function jsIdent(name: string): string {
  return RESERVED.has(name) ? `${name}_` : name;
}

// `a: u32, b: u32` for a function's arguments, and ` -> u32` for its result, in WIT syntax.
function witArgs(func: WIT.FuncClass): string {
  return func._args.map(([name, ty]) => `${name}: ${ty.name}`).join(', ');
}
function witResult(func: WIT.FuncClass): string {
  return func._ret.length > 0 ? ` -> ${func._ret.map((ty) => ty.name).join(', ')}` : '';
}

// The JS parameter list jco calls a function with, e.g. `(linkCount)` for `link-count`.
function jsArgs(func: WIT.FuncClass): string {
  return `(${func._args.map(([name]) => jsIdent(WIT.jsFieldName(name))).join(', ')})`;
}

// Each function or class is commented out on its own, so removing the `/*` and `*/` around it
// implements just that one. The editor is a plain textarea, which can't toggle line comments.
function commented(lines: string[]): string {
  return ['/*', ...lines, '*/'].join('\n');
}

function funcTemplate(key: string, func: WIT.FuncClass): string {
  const name = jsIdent(key);
  return commented([
    `// ${func.displayName(key)}: func(${witArgs(func)})${witResult(func)}`,
    ...(name === key
      ? [`export function ${key}${jsArgs(func)} {`, '}']
      : [`function ${name}${jsArgs(func)} {`, '}', `export { ${name} as ${key} };`]),
  ]);
}

function resourceTemplate(resource: WIT.ResourceClass): string {
  const members = Object.entries(resource._fields).map(([key, func]) => {
    const prefix = func.callKind === 'static' ? 'static ' : '';
    const wit = func.callKind === 'constructor'
      ? `constructor(${witArgs(func)})`
      : `${func.displayName(key)}: ${prefix}func(${witArgs(func)})${witResult(func)}`;
    return [
      `  // ${wit}`,
      `  ${prefix}${key}${jsArgs(func)} {`,
      '  }',
    ].join('\n');
  });
  return commented([`export class ${resource._name} {`, members.join('\n\n'), '}']);
}

// The first entry for each key, in order.
function firstByKey<T>(entries: Array<readonly [string, T]>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [key, value] of entries) {
    if (!map.has(key)) {
      map.set(key, value);
    }
  }
  return map;
}

// A commented-out implementation of an imported interface, from the WIT of each of its versions,
// to start editing from. Left commented out, its calls still ask for their results in the console.
// `asking` says where the imports left out ask for their results, the UI's console by default.
export function importTemplate(ifaces: WIT.InterfaceClass[], asking = 'in the console'): string {
  // jco gives all versions of an interface one import object; the first one's types stand for all.
  const funcs = firstByKey(ifaces.flatMap((iface) => Object.entries(iface._fields)));
  // jco takes a resource class from the import that defines it, not those that `use` it.
  const resources = firstByKey(ifaces.flatMap((iface) => iface.get_resources()
    .filter((r) => r._interface === iface._name)
    .map((r) => [r._name, r] as const)));
  return [
    [
      '// Remove the /* */ around a function or class to implement it in JavaScript. Calls to the',
      `// rest still ask for their results ${asking}, as do the methods a class leaves out.`,
    ].join('\n'),
    ...[...funcs].map(([key, func]) => funcTemplate(key, func)),
    ...[...resources.values()].map(resourceTemplate),
  ].join('\n\n');
}
