# Component UI

A browser-based explorer for [WebAssembly components](https://component-model.bytecodealliance.org/).
Load a `.wasm` component and every exported function gets a form generated from its WIT
signature, so you can call it, inspect the results, and mock the host for its imports, without
writing any glue code.

**Live demo:** https://chenyan2002.github.io/component-ui/

## Features

- **Forms from WIT types.** Arguments for records, variants, enums, options, results, lists,
  tuples, flags and resources are edited with typed inputs and validated before a call.
  **Random** fills empty fields with valid values and keeps the ones you typed.
- **Mock imports interactively.** Any import that isn't WASI and that you haven't implemented
  asks for its return value in the console when the guest calls it, and the guest waits for
  your answer. This includes methods of imported/host resources, which can also be passed to exports as mock arguments.
- **Implement imports in JavaScript.** Click **Implement in JavaScript** on the **Imports** bar to write an ES
  module for an imported interface, then **Apply and restart**. Functions you leave out still get mocked interactively.
- **Resource table.** Tracks each resource handle: who created it, whether it is live, moved
  or dropped, and which handle index it reuses. Live instances can be picked as arguments, and
  dropped from the table.
- **WASI in the browser.** WASI imports are provided by
  [`@bytecodealliance/preview2-shim`](https://www.npmjs.com/package/@bytecodealliance/preview2-shim),
  with stdout and stderr streamed to the console, an in-memory filesystem, and in-page sockets.

## Browser support

Component UI requires [JavaScript Promise Integration (JSPI)](https://github.com/WebAssembly/js-promise-integration),
which lets the guest suspend while you answer/mock an import.

## Command line

The same engine runs without the UI, e.g. for an agent to debug a component. Calls are written
as the console shows them, with [WAVE](https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave)
arguments, and run in order on one instance; a method takes its instance first, e.g.
`exports/x.get-a(#borrow-x-1)`:

```sh
npm run build:cli
node dist-cli/component-ui.mjs inspect public/resource.wasm
node dist-cli/component-ui.mjs call public/resource.wasm 'new exports/x(5)' 'exports.test-imports()' --save run.txt
```

Imports that aren't implemented, with `--imports <pkg>=<file.js>`, ask for answers. A run stops
at the first that has none and exits with 2, showing the type of value it expects, the types that
type uses, and the instances the answer could use. `--save` writes the run as an answers file,
with a `?` where it stopped:

```
//! component-ui call public/resource.wasm --defaults eager
//! imports implemented in JavaScript, whose calls aren't recorded: none
//! WASI comes from the shim and isn't recorded; a run may differ where the guest uses it, e.g. its clocks or random numbers
> new exports/x(5)  // = #x-1
> exports.test-imports()
//! new imports/y(10) = #y-1
imports/y.get-a(#borrow-y-1) = ?  // expects s32
```

Replace the `?` with the answer and run again, with the calls from the file:
`call public/resource.wasm --answers run.txt --save run.txt`. The file is the run:

- `> call` lines are the calls, and the lines after one the answers to the imports it made, in
  the order the guest called them: `import(args) = value`, the value in WAVE of the type the
  import returns, or `!trap` to trap the guest. Without its arguments, an answer answers any
  call to the import.
- `#mock` is a new mock of a host resource. `--save` writes each new mock as `#mock-<id>`, e.g.
  `#mock-y-2`, a new mock that is to get the id `y-2`, so that the later uses of `#y-2` show where
  it came from. It's an extension of WAVE's handle labels, as `#mock` is.
- Lines starting with `//!` are notes `--save` writes anew each time: the header, and where
  instances came from that no answer returned, e.g. a mock's constructor, which doesn't ask.
  Other comments are kept.

A run follows the file strictly: where the guest's calls differ from it, e.g. after an earlier
answer was edited, it stops with an error at the first line that doesn't match, and that line
and those after it are to be removed. A new mock that gets another id than its `#mock-<id>` says
stops it too.

Past the file's last answer, imports get the happy path where there is one, which `--save` marks
`// default`. `--defaults` says how far it goes:

- `eager`, the default: `ok`, for a `result`, and records and tuples of those; a new mock for a
  handle, noting the instances it passed over, e.g. `// default; instances of y: #y-1 (from new imports/y(10))`;
  or the only instance of a resource that can't be mocked.
- `careful`: as `eager`, but it stops where there are instances to choose, and answers must give
  their arguments.
- `none`: it stops at every import that asks, and answers must give their arguments.

The run is printed from the last answer on; `--from <line>` starts elsewhere, and `--all` prints
all of it. A run where a call fails, e.g. traps, exits with 3. In values, a `list<u8>` of text
is shown as `b"…"`, e.g. `b"MISS\u{0}"`, here and in the UI, and read back where WAVE is read.
The CLI needs Node 23 or later, and restarts itself with `--experimental-wasm-jspi` where that
is needed.

## How it works

1. **WIT → type AST.** [`crates/bindgen`](crates/bindgen) is a Rust component built on
   `wit-parser` and `wit-component`. It decodes the component's WIT and emits JavaScript that
   builds a type description (see [`src/wit.ts`](src/wit.ts)) of its imports and exports. It
   is compiled to `wasm32-wasip2` and transpiled with jco into [`src/obj`](src/obj), so it runs
   in the browser too.
2. **Transpile.** The component itself is transpiled in the browser by
   [jco](https://github.com/bytecodealliance/jco), with JSPI enabled for imports and exports.
3. **Instantiate.** WASI imports come from the preview2 shim; other imports come from your
   JavaScript, with console prompts and mocks standing in for whatever is missing
   ([`src/dialog.ts`](src/dialog.ts)).
4. **Render.** The UI is built with [Lit](https://lit.dev/) and
   [Web Awesome](https://webawesome.com/), and is essentially an interpreter over WIT types.

## Development

```sh
npm install
npm run dev        # start the Vite dev server
npm run typecheck  # type-check the app and the tests
npm run build      # type-check and build into dist/
npm run preview    # serve the production build
```

### Tests

End-to-end tests use [Playwright](https://playwright.dev/) against the production build:

```sh
npx playwright install chromium
npm test
```

The core also runs headless in Node, without the UI. [`tests/node`](tests/node) checks that, and
needs a Node with JSPI.

```sh
npm run test:node
```

### Rebuilding the bindgen component

`src/obj` is checked in, so this is only needed after changing `crates/bindgen`. It requires
Rust with the `wasm32-wasip2` target:

```sh
rustup target add wasm32-wasip2
npm run build:bindgen
```

## Known limitations

- Exported resource constructors and static functions are called synchronously, as jco emits
  invalid async code for them, so they can't wait on an import prompt. (waiting for a new jco release)
- Imports called during instantiation can't prompt.
- A real host object's method that receives a mock argument isn't routed to a prompt, so it may still fail in the host code.
- Calls are shown with their versioned interface, e.g. `wasi:http/types/fields@0.2.3.from-list(…)`,
  but the version isn't always the one the guest imported:
  - Semver-compatible versions of an interface (e.g., `wasi:io/streams@0.2.0` and `@0.2.3`) are
    merged into the newest one, so calls through either show as `@0.2.3`.
  - jco merges incompatible versions (e.g., 0.2.0 and 0.3.0) into one unversioned import, so
    a call can't be told apart by version: it is shown with, and a prompt asks for, the types
    of the first version that has the function, which may be the wrong form for the other.
- jco's async imports hang on failure; the loader patches jco's output to rethrow, which may need updating when jco changes. (waiting for a new jco release)
- The CLI's exit code doesn't reflect a guest calling `wasi:cli/exit`; the call shows the error
  the shim throws. Exiting with the guest's status is future work.
- The CLI's answers files don't record the calls of imports implemented in JavaScript, nor WASI,
  which the shim provides with real clocks and random numbers; a run can differ where the guest
  depends on those. Deterministic WASI is future work.
- While a call is waiting on an import, other calls are disabled, since the component instance
  can't be re-entered.
- jco doesn't expose the handle index of a host-implemented resource, so the resource table shows
  host instances as `host` and numbers them in creation order (e.g. `#y-1`) rather than by handle.
  If the host and the component both implement a resource of the same name, the host's instances
  are prefixed, e.g. `#host-y-1`, so ids stay unique.

## Acknowledgement

This work is inspired by [Candid UI](https://github.com/dfinity/candid/tree/master/tools/ui) and [proxy-component](https://github.com/chenyan2002/proxy-component), with significant help from Claude.
