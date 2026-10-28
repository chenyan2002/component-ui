---
name: component-ui
description: Run and debug a WebAssembly component (.wasm, component model / WIT) without its host. Calls its exports and answers its imports from a file you edit, with mocks for host resources, so you can see what the guest does, reproduce a bug, or test a subcomponent before composing it with wac. Use when a component's host isn't available, or to check what a component calls and how it reacts to what its imports return.
---

# Debugging a WebAssembly component with component-ui

`component-ui` runs a component on its own. You make the calls; every import the component
makes that nothing implements stops the run and asks you for its result. Your answers go in a
file that reproduces the run, so you build the run up one answer at a time, and replay it after
changing an answer or rebuilding the component.

## Setup

```sh
component-ui --help
```

If the command isn't found, build it from a checkout of component-ui (it needs Node 23 or later,
and restarts itself with `--experimental-wasm-jspi` where Node needs that flag):

```sh
npm install && npm run build:cli && npm link
```

## The loop

1. **See what the component has.** This shows the exports to call; the functions of host
   resources the exports use, which you can call to make their arguments; the imports that will ask
   for answers, and those answered on their own (constructors return a new mock, and functions
   without a result return nothing); and the named types they use. It shows the component's
   interfaces, not what it's built from: a component composed of others shows as one.

   ```sh
   component-ui inspect app.wasm
   ```

2. **Make the calls, saving the run.** Write each call as the output shows calls (see
   [Writing calls and values](#writing-calls-and-values)), in single quotes. The calls run in
   order on one instance of the component, so state carries over from one call to the next:

   ```sh
   component-ui call app.wasm 'new exports/x(5)' 'exports.test-imports()' --save run.txt
   ```

3. **Answer where it stopped.** Exit code 2 means an import needs an answer. The output says the
   type it expects, the definitions of the named types in it, and the instances the answer could
   use. `run.txt` has the run so far, with a `?` for the missing answer:

   ```
   > exports.test-imports()
   //! new imports/y(10) = #y-1
   imports/y.get-a(#borrow-y-1) = ?  // expects s32
   ```

   Replace the `?` with a value (edit the file; don't write it with `echo`, which mangles `\u{…}`
   escapes), and run again. With no calls on the command line, the run takes them from the file:

   ```sh
   component-ui call app.wasm --answers run.txt --save run.txt
   ```

   WASI comes from the shim, and the file records its answers, marked `// wasi`. A rerun gives
   the guest those recorded answers in place of the shim's, so it gets the same clocks, random
   numbers and environment; past them, the shim answers WASI as in the first run, and you only
   answer the component's own imports.

   Repeat until the run exits with 0 (all calls returned) or 3 (a call failed, e.g. trapped).
   The output starts at the answer you added; `--all` prints the whole run.

   The stop shows where the instances in the call came from, e.g.
   `#backend-4 is from …open-backend(#borrow-service-3, "kiad700…")`, which often is the answer,
   e.g. for the backend's name.

   **To save runs, answer ahead.** Once you can tell what the guest will ask next, write those
   answers after the one you filled in, in the order it will ask, each naming its call. The answers
   are a sequence: every import that asks, up to the file's last answer, needs a line, so keep the
   `// default` lines `--save` wrote between them. And once an import turns out to be a simple
   stateful object, e.g. a getter returning what a setter set, implement it with `--imports`
   instead of answering each call (see [Options worth knowing](#options-worth-knowing)).

4. **Review the defaults.** Imports past your last answer get the happy path where there is one:
   `ok` for results, and records and tuples of those; a new mock for a handle, or the only
   instance of a resource that can't be mocked. Other values, e.g. numbers, strings, options and
   lists, stop the run for you to answer. `--save` marks these `// default`. Look at each one before relying
   on the run, especially those that list other instances:

   ```
   imports/y.add(#y-1, 10) = #mock-y-2  // default; instances of y: #y-1 (from new imports/y(10))
   ```

   Here the host could have returned the `#y-1` it was given. Ask whether the guest expects one of
   the listed instances, e.g. when an import returns something it was given, or looks up an
   existing object. If so, change the value, e.g. to `#y-1`, and run again. A mock the guest then
   uses asks for its methods' results, so a wrong mock usually shows at the next stop; one the
   guest only passes back to the host or compares doesn't, so the note is the only sign.

5. **Change answers to explore.** Edit any answer, e.g. to `err(…)` or `!trap` to test the
   guest's error handling, and run again. If the guest then makes different calls, the run stops
   at the first line that no longer matches, saying so; delete that line and those after it, and
   run again to answer the new calls.

## Reading a run

- `› call` lines are your calls, `↳ import(…)` the imports the guest made during them, `= value`
  results, and `! error` failures. `(run.txt:7)` or `(default)` says where an answer came from;
  `(javascript)` and `(wasi)` mark the answers of `--imports` and of the WASI shim, which ran.
- `[stdout]` and `[stderr]` lines are the guest's output. A panic or failed assertion shows there,
  with the guest's source file and line, e.g. `panicked at src/lib.rs:27:15: index out of bounds`,
  or `Assertion failed: …get_a(borrowed_y) == 20`. It is often how you learn what the guest
  expected, so a wrong answer is a way to find the right one.
- A trap lists the guest's stack under its `!` line, innermost first, e.g.
  `at kv_store_component.wasm: …Entry::dtor`, then `at kv_test….wasm: kv_test::write_entry`. Its
  frames name the components a composed one is built from.
- **A guest panic right after one of your answers may be your answer breaking the host's
  contract, not a bug in the guest.** E.g. a host API that returns NUL-terminated strings; read
  the guest's message and the import's documentation before blaming the guest.

## Ask for the WIT with its comments

The WIT that `inspect` shows comes from the component itself, which keeps the types but usually
not the WIT's doc comments. Those often say what the types can't: how a string is encoded, what a
cursor means, what `none` stands for, which errors to expect. Without them, answers to such
imports are guesses. So before answering imports whose meaning isn't clear from their names and
types, ask the user for the original WIT files of the imported interfaces, with their comments,
or the host's documentation, and answer by them.

## Writing calls and values

Values are [WAVE](https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave):

| type | value |
|---|---|
| bool, numbers, char | `true`, `-3`, `1.5`, `nan`, `inf`, `'x'` |
| string | `"a \"q\"\n\u{1F44B}"` |
| `list<u8>` of text | `b"MISS\u{0}"` (component-ui's own; otherwise `[77, 73, 83, 83, 0]`) |
| list, tuple | `[1, 2]`, `(1, "a")` |
| record | `{x: 1, label: some("a")}`; fields that are `none` may be left out |
| option | `some(1)`, `none` |
| result | `ok`, `ok(1)`, `err("x")` |
| variant, enum | `case`, `case(payload)`; a case named like a keyword takes `%`, e.g. `%none` |
| flags | `{read, write}`, `{}` |
| handle | `#x-1` an instance you own, `#borrow-x-1` borrowed, `#mock` a new mock, `#mock-x-2` a new mock to get the id `x-2` |

**Misspelled record field names are ignored, not rejected**: `{x: 1, lable: some("a")}` reads as
`{x: 1}`, with `label` none. Check field names against `inspect`.

Calls are written as the output shows them, with the interface's version:

| call | written |
|---|---|
| function | `docs:calc/calculate@0.1.0.eval(add, 1, 2)`; at the world level just `eval(…)` |
| constructor | `new exports/x(5)` |
| static | `exports/x.add(#x-1, 2)` |
| method | `exports/x.get-a(#borrow-x-1)`: the instance comes first |
| drop | `drop #x-1`, which runs the resource's destructor |

Instances are numbered as they're created: `#x-1`, `#x-2`, …. An owned handle moves the instance
into the call, after which it's gone; pass `#borrow-…` where the function borrows. To pass an
export a host resource, e.g. an incoming request to an HTTP handler, write `#mock` for a new mock,
or create one first with the resource's constructor or static functions, which `inspect` lists
under host resources, e.g. `fastly:compute/http-req/request@0.1.0.new()`.

## The answers file

The user may give you one saved from component-ui's console in the browser (**Save logs**, in its
settings): it is the same format, so continue it with `--answers` as your own.

- `> call` lines are the calls; the lines after one answer the imports it made, in order.
- `import(args) = value` answers one call: `value` is WAVE of the type the import returns, or
  `!trap` to trap the guest. Without `(args)`, it answers the next call to the import, whatever its
  arguments, which is only for arguments that differ from run to run; it still answers one call.
- `//! import(args) = value` lines are the imports that didn't ask, e.g. `//! new imports/y(10) = #y-1`
  or `//! imports/y.set-a(#borrow-y-1, 20)`, and the guest's drops of host instances, e.g.
  `//! drop #y-2`, so that the file shows all the guest did with the host.
- `= ?` is an answer still to give.
- `import(args) = value  // javascript` and `// wasi` are answers recorded from the code that
  gave them: your `--imports` JavaScript, or the WASI shim.
  - A `// javascript` line answers like any other, so a replay needs no `--imports`, e.g. for a
    file saved in the browser with imports implemented there. Given `--imports` for a package, a
    replay skips its lines, and the JavaScript answers again.
  - A `// wasi` line is the shim's answer to a call. A replay runs the shim, and gives the guest
    the recorded answer in place of the shim's, so the run repeats exactly, e.g. the same random
    seed. A value with handles, e.g. `ok(#mock-output-stream-9)`, is the shim's own object, which
    is to get the id the line says. Edit a value, e.g. a clock reading, to see how the guest
    reacts. A guest whose WASI calls change, e.g. writing other text, stops at the first line
    that no longer matches, as for any other answer.
  - Remove the marker to make a line an answer of your own.
- `--save` writes each new mock as `#mock-<id>`, so that later uses of the id point back to where
  it was created; a replay checks the mock gets that id.
- All `//!` lines are written anew by each `--save`, as notes for the reader: those imports, the
  header, and where instances came from that no other line shows. The run doesn't read them.
  Your own `//` comments are kept.

## Options worth knowing

- `--defaults careful` stops wherever an answer could return one of several instances, rather
  than taking a mock; `--defaults none` stops at every import that asks. Both need every answer to
  give its arguments. Use them when a run behaves oddly around resources.
- `--imports <pkg>=<file.js>` implements an imported package in JavaScript, e.g. a calculator's
  `docs:adder/add`, when answering by hand gets tedious. `component-ui template app.wasm <pkg>`
  prints a module to start from. Functions and methods are named in camelCase, e.g. `getA` for
  `get-a`, and resources are classes. A function the world imports directly, e.g.
  `import log-line: func(text: string)`, is a package of its own, `log-line`, whose module exports
  it as `default`. Values follow jco: records are objects with camelCase
  fields, variants `{ tag, val }`, options `null` or the value, `u64`/`s64` BigInts, `list<u8>` a
  `Uint8Array`; a function returning a `result` returns its `ok` value and throws its `err` value.
  Their calls show in the run, and `--save` records their results, marked `// javascript`, so the
  file replays without `--imports`. Where an argument is a mock, which your code
  didn't make, your function isn't called: the call asks for an answer instead, and its line says
  `~ your JavaScript … wasn't called, as an argument is a mock`.
- `--from <line>` prints the run from the answer on that line of the file.
- WASI comes from the shim by default. Its calls show in the run, e.g.
  `wasi:cli/stdout@0.2.9.get-stdout()` and the `output-stream.write(…, b"…")` calls that follow, and
  `--save` records their results, marked `// wasi`, which a replay gives the guest again.
- `--no-wasi-shim` doesn't provide WASI from the shim: WASI imports ask like any other, and the
  answers file answers them, `// wasi` lines included; past them, you answer each, e.g. `ok(4096)`
  for a `check-write`. Use it to answer WASI yourself, e.g. to make a write fail. Give it to
  `inspect` and `template` too, to see and implement the WASI imports.

## Limits

- WASI comes from a shim, with an in-memory filesystem, and real clocks and random numbers. A
  replay gives the guest what a run recorded of them, so a guest that depends on those replays the
  same way, e.g. iterates a hash map in the same order; past the recording, they are new.
- A replay without the shim doesn't show the HTTP response a handler sends: turning it into HTTP
  needs the shim.
- Imports the component calls while it is instantiated can't ask for answers.
- Nor can imports a resource's destructor calls: the call fails with
  `cannot block a synchronous task before returning`, e.g. when the guest drops a resource whose
  destructor closes a host object. That's component-ui's limit, not the guest's bug; the run can't
  get past it, so report what happened up to there.
- A guest calling `wasi:cli/exit` shows as an error; the exit code doesn't follow it.

## Exit codes

| code | meaning |
|---|---|
| 0 | every call returned |
| 2 | an import needs an answer: fill in the `?` |
| 3 | a call failed, e.g. trapped |
| 1 | an error, e.g. the run no longer matches the answers file, or a bad call or answer |
