import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);

// The runes of Svelte are compiled away in the app. In the tests, the modules that use them are
// only loaded, never relied on for reactivity: a rune is its value.
globalThis.$state = (value) => value;
globalThis.$state.raw = (value) => value;
globalThis.$derived = (value) => value;
globalThis.$derived.by = (compute) => compute();
globalThis.$effect = () => {};
globalThis.$effect.pre = () => {};
