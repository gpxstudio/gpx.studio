# wasm

The engine of [`../gpx-rs`](../gpx-rs) for the browser: WebAssembly, exposed to the page through
`wasm-bindgen`. Each exported function is a thin wrapper over `gpx_engine::api` (see `../gpx-rs/src/api`)
that parses what the page sends and turns the result into JS objects (`src/convert.rs`, with
`serde-wasm-bindgen`) or typed arrays. The storage in the browser (IndexedDB) is here too, as it
is specific to the browser.

```
wasm-pack build --target bundler
```

The website imports the result as `gpx-wasm` (`pkg/`). The functions are tested in Node (it needs
`wasm-pack`, which fetches the test runner the first time):

```
wasm-pack test --node
```

`src/ts.rs` declares the TypeScript types of the objects that cross.
