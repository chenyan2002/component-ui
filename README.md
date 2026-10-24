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
- While a call is waiting on an import, other calls are disabled, since the component instance
  can't be re-entered.
- jco doesn't expose the handle index of a host-implemented resource, so the resource table shows
  host instances as `host` and numbers them in creation order (e.g. `#y-1`) rather than by handle.
  If the host and the component both implement a resource of the same name, the host's instances
  are prefixed, e.g. `#host-y-1`, so ids stay unique.

## Acknowledgement

This work is inspired by [Candid UI](https://github.com/dfinity/candid/tree/master/tools/ui) and [proxy-component](https://github.com/chenyan2002/proxy-component), with significant help from Claude.
