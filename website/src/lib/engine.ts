import { writable, type Subscriber, type Writable } from 'svelte/store';

class Engine {
    _engine: Writable<any>;

    constructor() {
        this._engine = writable(null);
        import('gpx-rs').then((wasm) => {
            this._engine.set(new wasm.Engine(this.onUpdate));
        });
    }

    subscribe(run: Subscriber<any>, invalidate?: () => void) {
        return this._engine.subscribe(run, invalidate);
    }

    onUpdate(message: String) {
        console.log('message from WASM: ' + message);
    }
}

export const engine = new Engine();
