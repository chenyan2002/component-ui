#!/bin/sh
# Rebuilds src/obj, the transpiled crates/bindgen component that turns a component's WIT into
# the type AST the UI renders. Requires the wasm32-wasip2 target (`rustup target add wasm32-wasip2`).
set -eu
cd "$(dirname "$0")/.."

cargo build --release --lib --target wasm32-wasip2 --manifest-path crates/bindgen/Cargo.toml
rm -rf src/obj
npx jco transpile crates/bindgen/target/wasm32-wasip2/release/bindgen.wasm --no-nodejs-compat --out-dir src/obj
