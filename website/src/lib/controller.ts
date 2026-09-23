class Engine {
    _engine: Writable<any>;

    constructor() {
        this._engine = null;
        import('gpx-rs').then((wasm) => {
            this._engine = new wasm.Controller();
        });
    }
}
