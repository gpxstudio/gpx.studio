// The engine of the files, as the UI sees it: stores that follow what the WASM engine holds.
//
// - `engine.ts`: the facade, with the actions and the stores
// - `types.ts`: the types of what it gives
// - `file-state.ts`: reads the state of a file (GeoJSON features, statistics...) from the engine
// - `statistics.ts`: reads the statistics of the selection, and only the metrics that are needed
// - `storage.ts`: opens the storage of the browser, and imports what the old versions kept
// - `observer.ts`: tells when the stores of the files appear and disappear
// - `convert.ts`: conversions between the UI's values and the engine's

export * from './types';
export { engine } from './engine';
export { FileStateCollectionObserver } from './observer';
