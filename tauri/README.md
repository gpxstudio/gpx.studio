# tauri

The desktop app of gpx.studio, built with [Tauri 2](https://v2.tauri.app/).
Its UI is the website ([`../website`](../website)), and it runs the engine of [`../gpx-rs`](../gpx-rs) natively instead of in WebAssembly.

## Development

You will need the same tools as for the website: [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/) and [wasm-pack](https://rustwasm.github.io/wasm-pack/).
To run the app in development mode, you will also need to install the [system dependencies of Tauri](https://v2.tauri.app/start/prerequisites/) for your platform and the Tauri CLI:

```bash
cargo install tauri-cli --version "^2"
```

### Setting up the frontend

The desktop app does not use the WebAssembly engine, but the website depends on its package.
From the root of the repository, build it once and install the website’s dependencies:

```bash
cd wasm && wasm-pack build --target bundler && cd ..
npm install --prefix website
```

For the MapTiler layers, add your key to `website/.env`, as explained in the [main README](../README.md#running-the-website).

### Running the app

```bash
cd tauri
cargo tauri dev
```

### Testing

```bash
cargo test -p gpx-studio-desktop
```
