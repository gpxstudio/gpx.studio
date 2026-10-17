import type { Backend } from './types';

export type { Backend } from './types';

/** Whether the page runs in the desktop app, which has the engine in its own process. */
export function inDesktopApp() {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Starts the engine of the files: the one of the desktop app when the page runs in it, the
 * WebAssembly module otherwise.
 */
export async function loadBackend(): Promise<Backend> {
    return inDesktopApp()
        ? (await import('./tauri')).createTauriBackend()
        : (await import('./wasm')).createWasmBackend();
}
