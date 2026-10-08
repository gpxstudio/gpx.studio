# gpx-rs

- `engine`: the GPX engine, plain Rust. Tested natively: `cargo test`.
- `wasm`: the interface to the web page, compiled to WebAssembly.

```
wasm-pack build wasm --target bundler --out-dir ../pkg
```

The interface is tested in Node (it needs `wasm-pack`, which fetches the test runner the first time):

```
wasm-pack test --node wasm
```
