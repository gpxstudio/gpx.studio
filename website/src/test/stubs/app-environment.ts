// The tests run like the browser does, which is where the engine is available.
export const browser = true;
export const dev = false;
export const building = false;
export const version = 'test';

// what the code that checks `browser` reads of the window
(globalThis as { window?: unknown }).window ??= { innerWidth: 1280, innerHeight: 800, URL };
