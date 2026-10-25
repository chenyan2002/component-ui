# Gap between component-ui and proxy-component

[proxy-component](https://github.com/chenyan2002/proxy-component) instruments a component to
record, replay, fuzz or mock its imports. Its dialog mode does what component-ui does in the
browser. Ideally a call log from one tool could be replayed by the other. That isn't possible
yet; this file lists what stands in the way. It was written against proxy-component `128aa4e`
and the wasm-wave fork it depends on (`chenyan2002/wasm-tools`, branch `extend-wave`, commit
`efecaa18`, crate version 0.239.0).

## proxy-component's trace format

A trace is JSON Lines. Each line is one serde externally tagged `FuncCall`
(`crates/trace/src/lib.rs`):

```
{"ExportArgs":{"method":"docs:calc/calculate.eval","args":["\"1+2\""]}}
{"ImportArgs":{"method":"[method]wasi:io/streams/output-stream.blocking-write-and-flush","args":["#borrow-output-stream-1","[51, 10]"]}}
{"ImportRet":{"method":"[method]wasi:io/streams/output-stream.blocking-write-and-flush","ret":"ok"}}
{"ExportRet":{"method":"docs:calc/calculate.eval","ret":"ok(3)"}}
```

- `args` holds one WAVE string per parameter. For methods, `self` comes first.
- `ret` is `null` for functions without a result.
- Lines that don't parse as a `FuncCall` are skipped silently, so the app's own stdout can be
  mixed in.
- Entries are in call order: `ExportArgs`, then the export's `ImportArgs`/`ImportRet` pairs, then `ExportRet`.

Replay takes entries strictly in order:

- `ExportArgs` must come next when an export is replayed. Its args are parsed with the
  function's types.
- Every import the guest makes takes the next `ImportRet`, and its `ret` is parsed. An
  `ImportArgs` before it is optional; if present, its `method` and `args` must equal the
  replayed call's.
- `ExportRet` is optional; if present, its `method` and `ret` must equal the replayed call's.
- `wasi:cli/exit` needs no `ImportRet`. The replay exits with its argument's status instead.

**`ImportArgs.args` and `ExportRet.ret` are compared as exact strings**, so a writer has to
produce byte for byte what the fork's writer does. `ExportArgs.args` and `ImportRet.ret` only
need to be valid WAVE.

## Value encoding

Both tools read and write [WAVE](https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave)
with the same writer and parser: component-ui calls the fork's wasm-wave from
[`crates/bindgen`](../crates/bindgen) ([`src/wave.ts`](../src/wave.ts)). Escaping, floats, and
the omission of `none` record fields therefore match, e.g. `"it\'s"`, `1000000000000000000000`,
`{a: 1}` for `{a: 1, b: none}`.

### Unknown record fields are ignored

wasm-wave reads a record without checking for fields the record type doesn't have: as a
`record { x: s32, label: option<string> }`, `{x: 1, y: 2}` reads as `{x: 1}`, and
`{x: 1, lable: some("a")}` as `{x: 1}`, with `label` none. This comes from upstream wasm-wave
(`to_wasm_record` in `crates/wasm-wave/src/ast.rs`), not the fork, so both tools behave alike.
A misspelled field is dropped silently instead of rejected, and for an optional field the value
quietly becomes `none`, so hand-written WAVE, e.g. an agent's answers or a hand-edited trace,
may not mean what it says. [`tests/node/wave.test.ts`](../tests/node/wave.test.ts) asserts the
current behavior under a `FIXME`, so a fix in wasm-wave shows up there as a failing test.

### Handle labels

Each tool chooses its handle labels itself. Both write an owned handle as `#x-1` and a borrowed
one as `#borrow-x-1`, and read only what they write: the label must name the handle's resource,
and have the `borrow-` prefix exactly for a borrow.

| | component-ui | proxy-component |
|---|---|---|
| Owned handle | `#x-1` | `#x-1` |
| Borrowed handle | `#borrow-x-1` | `#borrow-x-1` |
| Reading `#x-1` as a borrow, `#borrow-x-1` as an owned handle, or `#y-1` for an `x` | a parse error | a panic, `invalid handle label` (the `ToRust` impls in `src/traits/wave.rs`) |
| Handle of a host resource | numbered in creation order, from 1, never reused; `host-` prefix when the guest exports a resource of the same name | its handle index, which is reused after a drop |
| Handle of a guest resource | its handle index in jco's table | its handle index in the instrumented component's table; whether the two agree is unverified |
| A new mock instance | `#mock`, when read | none; replay creates one for each owned label it hasn't seen |
| Futures, streams, error-context | not supported | not supported |

Besides the labels proxy-component reads, component-ui reads `#mock`, and ids with the `host-`
prefix, e.g. `#host-y-1`; proxy-component would reject both.

### `#mock-<id>`

component-ui's answers files write a new mock as `#mock-<id>`, e.g. `#mock-y-2` for a new mock
that is to get the id `y-2`, and read it as a new mock, checking it gets that id. Like `#mock`,
it's an extension of WAVE's handle labels, which proxy-component doesn't read.

### `b"…"` for bytes

component-ui shows a `list<u8>` of text as `b"…"`, e.g. `b"MISS\u{0}"` for `[77, 73, 83, 83, 0]`,
in the console, the CLI and the arguments of call records, and reads it back. That isn't WAVE:
proxy-component, like wasm-wave, writes and reads only the list. Text here is valid UTF-8 without
control characters other than tabs, newlines and NULs. A trace for proxy-component would have to
write the list.

## Function names

| | component-ui (console labels) | proxy-component (trace `method`) |
|---|---|---|
| Function | `wasi:cli/stdout@0.2.0.get-stdout` | `wasi:cli/stdout.get-stdout` |
| Method | `ns:pkg/iface/x@1.0.0.method(#borrow-x-1, …)`; `self` is the first argument | `[method]ns:pkg/iface/x.method`; `self` is the first argument |
| Constructor | `new ns:pkg/iface/x@1.0.0(…)` | `[constructor]ns:pkg/iface/x.new` (Rust's constructor name) |
| Static | `ns:pkg/iface/x@1.0.0.func(…)` | `ns:pkg/iface/x.func`, without a `[static]` prefix |
| World-level function | `func(…)` | not supported |
| Drop | `drop #x-1` | not recorded |

component-ui logs each call as a record ([`src/call-record.ts`](../src/call-record.ts)) with its
interface (versioned), resource, function name and arguments apart, a method's `self` first, as in
proxy-component; the labels above are made from it. A proxy-component name could be made from a
record too, but not the other way: proxy-component's names lose versions.

proxy-component builds names from the generated Rust module paths and converts them back to
kebab case (`src/codegen/util.rs`, `wit_func_name`), which loses information:

- Versions are dropped, so two versions of one package get the same names.
- The kebab-case round trip is lossy, e.g. WIT `http-1-1` becomes Rust `Http11` and then `http11`.
- When a world imports several versions of a package, its Rust module names include the version, e.g. `io0_2_0`, which comes back as `io0-2-0`.
- Handle labels carry the resource's name but not its interface, so two resources with the
  same name can't be told apart.

## What each tool can call and log

- **WASI.** proxy-component instruments every import, WASI included, so a replay needs an
  `ImportRet` for each WASI call. component-ui serves WASI from
  `@bytecodealliance/preview2-shim` and doesn't log those calls.
- **Methods of guest-exported resources.** proxy-component records them but can't replay them
  (`src/codegen/mod.rs`, `export_funcs` skips methods). component-ui calls them.
- **Mock resources passed to exports.** component-ui writes them as owned handles. That matches
  how proxy-component's replay creates mocked resources from owned labels in `ExportArgs`.
- **`wasi:cli/exit`.** proxy-component special-cases it during replay. component-ui treats it
  as an ordinary shim call.

## component-ui's answers files

component-ui's CLI writes a run as an answers file (see the [README](../README.md#command-line)),
and so does the UI's console, with **Save**:
`> call` lines for the export calls, and after each, the answers its imports got, in order,
`import(args) = value`. That is close to proxy-component's trace: a call line for `ExportArgs`,
an answer line for an `ImportArgs` and its `ImportRet`. The differences:

- An answers file records only the imports that ask for answers: not those implemented in
  JavaScript, those without a result, or WASI, which proxy-component records too.
- It doesn't record export results (`ExportRet`), but writes them as comments.
- Its names, handles and values differ as above: versioned interfaces, `#mock` and `#mock-<id>`,
  `b"…"`, and comments, e.g. where instances came from.

## What closing the gap would take

1. Done: one WAVE writer and parser for both tools (see [Value encoding](#value-encoding)).
2. Done: structured call records in component-ui ([`src/call-record.ts`](../src/call-record.ts)),
   with the interface, resource, kind, function and WAVE arguments of each call, so a trace
   can be written from them.
3. A component-ui recorder that writes the four entry types with proxy-component's names,
   including WASI calls.
4. A component-ui replayer that answers imports from a trace in order, WASI included, and
   asks for whatever the trace doesn't cover.
5. Agreement on the parts that are lossy or unverified: versioned names, interface-qualified
   handle labels, how host resource handles are numbered, and whether jco's handle indices for
   guest resources match wasmtime's.
