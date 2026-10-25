import { demangle as demangleSymbol } from './obj/bindgen';

// The guest's frames in the stack of an error it trapped with, e.g.
// `kv_store_component.wasm: kv_store_component::bindings::exports::fastly::compute::kv_store::Entry::dtor`.

// The source-level name of a symbol, e.g. `core::fmt::Write::write_fmt` for Rust's
// `_ZN4core3fmt5Write9write_fmt17h7aff65a257b1f7edE`, or C++'s; other names as they are.
// rustc-demangle and cpp_demangle do this, in crates/bindgen.
export function demangle(name: string): string {
  return demangleSymbol(name) ?? name;
}

// Frames of the guest's language runtime rather than its code, e.g. of a panic or an abort.
const RUNTIME = /^<?(std|core|alloc|panic_unwind|panic_abort)::|^(abort|__assert_fail|__rust_|rust_begin_unwind|rust_panic)/;

// The named wasm frames of an error's stack, innermost first, as `module: function`, without
// those of the guest's runtime, e.g. Rust's panic machinery. V8 writes a wasm frame as
// `at module.wasm.function (wasm://wasm/…)`; other engines' stacks give none.
export function wasmFrames(err: unknown): string[] {
  const stack = err instanceof Error ? err.stack ?? '' : '';
  return stack.split('\n').flatMap((line) => {
    const frame = /^\s*at (.+?) \(wasm:\/\/wasm\/[^)]*\)$/.exec(line);
    if (!frame) {
      return [];
    }
    // `module.wasm.function`, or just `function`.
    const named = /^(.*?\.wasm)\.(.+)$/.exec(frame[1]);
    const [module, func] = named ? [named[1], named[2]] : [undefined, frame[1]];
    const name = demangle(func);
    // A function without a name shows as its module's.
    if (RUNTIME.test(name) || /\.wasm$/.test(name)) {
      return [];
    }
    return [module ? `${module}: ${name}` : name];
  });
}
