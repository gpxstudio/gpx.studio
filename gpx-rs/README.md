# gpx-rs

The GPX engine: plain Rust, no knowledge of who uses it. Tested natively with `cargo test` (from
here or from the root).

- `src/core`, `src/engine`, `src/storage`: the engine itself.
- `src/api`: the interface to the engine that the frontends (`../wasm`, `../tauri`) share. Each
  function takes the engine and typed arguments, and gives plain data (`api::dto`, serde types, or
  slices for the numeric buffers). A frontend only converts what crosses: ids from strings or
  bytes, results to JS objects or JSON, slices to typed arrays or raw bytes.
