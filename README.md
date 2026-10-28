# Component UI

A browser-based explorer for [WebAssembly components](https://component-model.bytecodealliance.org/).
You can run and debug a Wasm component in the browser without its host.
Imports are mocked by your input, so you can see how the guest reacts to what its imports return, reproduce a bug, or
test a subcomponent before composing it with `wac`.

**Live demo:** https://chenyan2002.github.io/component-ui/

## Features

- **UI widget from WIT types.** Each WIT type maps to a UI widget, so you can enter valid arguments structurally in the browser.
- **Mock imports interactively.** Any import that hasn't been implemented is mocked: when the
  guest calls it, the console prompts for its return value, and the guest waits for your answer. This includes methods of imported/host resources, which can also be passed to exports as mock arguments.
- **Resource table.** Tracks each resource handle: who created it, whether it is live, moved
  or dropped, and which handle index it reuses. Live instances can be picked as arguments, and
  dropped from the table.
- **Deterministic replay.** The call logs can be saved locally and replayed in the [command line](#command-line).
  The call log of imports implemented in JavaScript and of the WASI shim are also recorded, so a replay is deterministic.

## Browser support

Component UI requires [JavaScript Promise Integration (JSPI)](https://github.com/WebAssembly/js-promise-integration),
which lets the guest suspend while you answer/mock an import.

## Command line

The same engine runs without the UI, e.g. for an agent to debug a component. Calls are written
as the console shows them, with [WAVE](https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave)
arguments. It needs Node 23 or later; `--help` lists its options.

```sh
npm run build:cli
node dist-cli/component-ui.mjs inspect public/resource.wasm
node dist-cli/component-ui.mjs call public/resource.wasm 'new exports/x(5)' 'exports.test-imports()' --save run.txt
```

### As a skill for agents

[`skills/component-ui`](skills/component-ui/SKILL.md) teaches an agent, e.g. Claude Code, to debug
components with the CLI. To use it in any project, put the CLI on the `PATH`, and the skill where
the agent finds skills, e.g. for Claude Code:

```sh
npm run build:cli && npm link
ln -s "$PWD/skills/component-ui" ~/.claude/skills/component-ui
```

## How it works

1. **WIT → type AST.** [`crates/bindgen`](crates/bindgen) is a Rust component built on
   `wit-parser` and `wit-component`. It decodes the component's WIT and emits JavaScript that
   builds a type description (see [`src/wit.ts`](src/wit.ts)) of its imports and exports. It
   also reads and writes values in WAVE, with proxy-component's fork of `wasm-wave`.
2. **Transpile.** The component itself is transpiled in the browser by
   [jco](https://github.com/bytecodealliance/jco), with JSPI enabled for imports and exports.
3. **Instantiate.** WASI imports come from the preview2 shim, unless it is turned off; other
   imports come from your JavaScript, with console prompts and mocks standing in for whatever is
   missing ([`src/dialog.ts`](src/dialog.ts)).
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

- Currently only supports p2 component. Deterministically replaying p3 component is future work.
- A real host object's method that receives a mock argument isn't routed to a prompt, so it may still fail in the host code.
- Calls are shown with their versioned interface, e.g. `wasi:http/types/fields@0.2.3.from-list(…)`,
  but the version isn't always the one the guest imported:
  - Semver-compatible versions of an interface (e.g., `wasi:io/streams@0.2.0` and `@0.2.3`) are
    merged into the newest one, so calls through either show as `@0.2.3`.
  - jco merges incompatible versions (e.g., 0.2.0 and 0.3.0) into one unversioned import, so
    a call can't be told apart by version: it is shown with, and a prompt asks for, the types
    of the first version that has the function, which may be the wrong form for the other.
- Component instantiation and resource destructor cannot be made asynchronous. This means, in browser,
  we can't mock import calls inside these two places. We either need a JS stub for these imports or provide
  the response via the answer file. CLI doesn't have this restriction, as the responses are given from the file.
- The CLI's exit code doesn't reflect a guest calling `wasi:cli/exit`; the call shows the error
  the shim throws. Exiting with the guest's status is future work.
- The WIT shown, in the UI and by the CLI, is the one embedded in the component, which keeps the
  types but usually not the doc comments of the original WIT.
  Answering such imports well needs the original WIT files or the host's documentation;
  the skill tells agents to ask for them.
- While a call is waiting on an import, other calls are disabled, since the component instance
  can't be re-entered.
- jco doesn't expose the handle index of a host-implemented resource, so the resource table shows
  host instances as `host` and numbers them in creation order (e.g. `#y-1`) rather than by handle.
  If the host and the component both implement a resource of the same name, the host's instances
  are prefixed, e.g. `#host-y-1`, so ids stay unique.

## Acknowledgement

This work is inspired by [Candid UI](https://github.com/dfinity/candid/tree/master/tools/ui) and [proxy-component](https://github.com/chenyan2002/proxy-component), with significant help from Claude.
