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

/**
 * The rows of a sticky tree that are stuck, by node, with how deep they are: only the deepest one
 * gets the border that shows where the rows end.
 */
export class StuckRows {
    private rows: Record<string, number> = $state({});

    set(id: string, depth: number, stuck: boolean) {
        if (stuck) {
            this.rows[id] = depth;
        } else if (id in this.rows) {
            delete this.rows[id];
        }
    }

    /** The depth of the deepest row that is stuck, -1 if none is. */
    get deepest(): number {
        return Math.max(-1, ...Object.values(this.rows));
    }
}
