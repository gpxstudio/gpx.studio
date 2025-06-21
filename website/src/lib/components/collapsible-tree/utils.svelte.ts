export class CollapsibleNodeState {
    private _open: boolean;

    constructor(defaultState: 'open' | 'closed') {
        this._open = $state(defaultState === 'open');
    }

    get current(): boolean {
        return this._open;
    }

    set current(value: boolean) {
        this._open = value;
    }
}

export class CollapsibleTreeState {
    private _open: Record<string, CollapsibleNodeState> = {};
    private _defaultState: 'open' | 'closed';

    constructor(defaultState: 'open' | 'closed') {
        this._defaultState = defaultState;
    }

    get(id: string): CollapsibleNodeState {
        if (this._open[id] === undefined) {
            this._open[id] = new CollapsibleNodeState(this._defaultState);
        }
        return this._open[id];
    }
}
