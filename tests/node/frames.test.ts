import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collapsedFrames, demangle, wasmFrames } from '../../src/frames';

test('Rust legacy symbols are demangled, without their hashes', () => {
  assert.equal(demangle('_ZN4core3fmt5Write9write_fmt17h7aff65a257b1f7edE'), 'core::fmt::Write::write_fmt');
  assert.equal(
    demangle('_ZN88_$LT$fastly..http..response..handle..ResponseHandle$u20$as$u20$core..ops..drop..Drop$GT$4drop17h1f0f37a3d8d70077E'),
    '<fastly::http::response::handle::ResponseHandle as core::ops::drop::Drop>::drop',
  );
  assert.equal(demangle('_ZN3std2rt10lang_start28_$u7b$$u7b$closure$u7d$$u7d$17h10189360b46202adE.llvm.17813077353134070336'), 'std::rt::lang_start::{{closure}}');
  assert.equal(demangle('exports_test_imports'), 'exports_test_imports');
  // Rust's v0 scheme, and C++'s.
  assert.equal(demangle('_RNvCs5Q8mZ1VJr5b_7example4main'), 'example::main');
  assert.equal(demangle('_ZN3foo3barEi'), 'foo::bar(int)');
});

test('a trap\'s wasm frames, without the runtime\'s and unnamed ones', () => {
  const err = new Error('trap');
  err.stack = [
    'RuntimeError: wasm trap',
    '    at kv_store_component.wasm.abort (wasm://wasm/kv-00:wasm-function[3232]:0x146d56)',
    '    at kv_store_component.wasm._ZN3std7process5abort17h0123456789abcdefE (wasm://wasm/kv-00:wasm-function[3027]:0x1388)',
    '    at wasm://wasm/6c31003e:wasm-function[164]:0x10d5',
    '    at kv_store_component.wasm._RNCNvNtCs5Q8mZ1VJr5b_3std9panicking13panic_handler0B5_ (wasm://wasm/kv-00:wasm-function[3019]:0x137cab)',
    '    at kv_store_component.wasm._ZN18kv_store_component5Entry4dtor17hb961d3a9148372e9E (wasm://wasm/kv-00:wasm-function[287]:0x12aaa)',
    '    at kv_test-697c.wasm (wasm://wasm/kv-01:wasm-function[9]:0x10)',
    '    at fastly:compute/http-incoming@0.1.0#handle (wasm://wasm/6c31003e:wasm-function[122]:0xe81)',
    '    at trampoline166 (file:///tmp/module-23.mjs:63784:22)',
  ].join('\n');
  assert.deepEqual(wasmFrames(err), ['kv_store_component.wasm: kv_store_component::Entry::dtor', 'fastly:compute/http-incoming@0.1.0#handle']);
});

test('all frames show, with a run of the same frame as one, e.g. of a recursion', () => {
  const recursion = Array.from({ length: 200 }, () => 'app.wasm: app::recurse');
  assert.deepEqual(collapsedFrames(['app.wasm: app::leaf', ...recursion, 'app.wasm: app::run']), [
    'app.wasm: app::leaf', 'app.wasm: app::recurse  (×200)', 'app.wasm: app::run',
  ]);
  // Only runs: a frame that comes back later shows again.
  assert.deepEqual(collapsedFrames(['a', 'b', 'a']), ['a', 'b', 'a']);
});
