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

Both tools write [WAVE](https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave).
component-ui's writer is [`src/wave.ts`](../src/wave.ts) and has no parser; values are entered
through forms. proxy-component uses the fork's writer and parser (`crates/wasm-wave/src/writer.rs`).

| | component-ui | proxy-component |
|---|---|---|
| Owned handle | `#x-1` | `#x-1` |
| Borrowed handle | `#borrowed-x-1` | `#borrow-x-1` |
| Handle of a host resource | numbered in creation order, from 1, never reused; `host-` prefix when the guest exports a resource of the same name | its handle index, which is reused after a drop |
| Handle of a guest resource | its handle index in jco's table | its handle index in the instrumented component's table; whether the two agree is unverified |
| Record field set to `none` | written, `{a: none}` | omitted; all `none` gives `{:}` |
| Quotes in strings and chars | only the enclosing quote is escaped | both are escaped, e.g. `"it\'s"` |
| Other escapes | control characters as `\u{…}` | control characters as `\u{…}`, plus whatever Rust's `char::escape_debug` escapes, e.g. combining marks (U+0301) and U+200B, U+FEFF |
| Floats | JS `Number#toString`, which uses exponents (`1e21`, `1e-7`) | Rust `Display`, which never does (`1000000000000000000000`, `0.0000001`) |
| `f32` | shortest decimal that reads back as the same `f32` | the same, via Rust `Display` for `f32` |
| NaN, infinities, `-0` | `nan`, `inf`, `-inf`, `-0` | the same |
| `option<option<T>>`, results, flags, enums, variants, keywords | | the same: `some(none)`, `ok`/`err(v)`, `{a, b}`, `%`-prefixed keywords |
| Futures, streams, error-context | not supported | not supported |

The fork also accepts input that component-ui never writes, e.g. exponents in floats. A shared
parser would need to accept both tools' output.

## Function names

| | component-ui (console labels) | proxy-component (trace `method`) |
|---|---|---|
| Function | `wasi:cli/stdout@0.2.0.get-stdout` | `wasi:cli/stdout.get-stdout` |
| Method | `#borrowed-x-1.method(…)`; the receiver isn't an argument | `[method]ns:pkg/iface/x.method`; `self` is the first argument |
| Constructor | `new ns:pkg/iface/x@1.0.0(…)` | `[constructor]ns:pkg/iface/x.new` (Rust's constructor name) |
| Static | `ns:pkg/iface/x@1.0.0.func(…)` | `ns:pkg/iface/x.func`, without a `[static]` prefix |
| World-level function | `func(…)` | not supported |
| Drop | `drop #x-1` | not recorded |

component-ui's labels are text for display, not structured records. A call's interface,
function and arguments aren't kept separately ([`src/calls.ts`](../src/calls.ts),
[`src/dialog.ts`](../src/dialog.ts)).

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

## What closing the gap would take

1. One WAVE writer and parser for both tools. If component-ui calls the fork's wasm-wave from
   [`crates/bindgen`](../crates/bindgen), both get the same escaping and float formatting
   without copying Rust's rules into TypeScript. This is planned independently of interop.
2. Structured call records in component-ui (interface, resource, kind, function, WAVE
   arguments, result) instead of label text, so a trace can be written from them.
3. A component-ui recorder that writes the four entry types with proxy-component's names,
   including WASI calls.
4. A component-ui replayer that answers imports from a trace in order, WASI included, and
   asks for whatever the trace doesn't cover.
5. Agreement on the parts that are lossy or unverified: versioned names, interface-qualified
   handle labels, how host resource handles are numbered, and whether jco's handle indices for
   guest resources match wasmtime's.
