import { browser } from '$app/environment';
import { writable, type Readable } from 'svelte/store';
import type { FileStructure, Selection } from 'gpx-rs';

export type {
    FileStructure,
    FilesUpdate,
    Selection,
    TrackNode,
    SegmentNode,
    WaypointNode,
} from 'gpx-rs';

type Wasm = typeof import('gpx-rs');

/** Hyphenated UUID strings (as found in the file structures) to the concatenated 16-byte form. */
function idsToBytes(ids: string[]): Uint8Array {
    const bytes = new Uint8Array(ids.length * 16);
    ids.forEach((id, i) => {
        const hex = id.replaceAll('-', '');
        for (let j = 0; j < 16; j++) {
            bytes[i * 16 + j] = parseInt(hex.slice(2 * j, 2 * j + 2), 16);
        }
    });
    return bytes;
}

/**
 * Thin wrapper around the WASM engine.
 *
 * The engine owns the files; this class mirrors what the UI needs in stores. After each action,
 * only what the engine reports as changed is read again: the order of the files, and the
 * structure of the files that were added or modified.
 */
class Engine {
    private wasm: Wasm | null = null;
    /** Resolves once the engine can be used (never on the server). */
    readonly ready: Promise<void>;

    private _order = writable<string[]>([]);
    private _structures = writable<Map<string, FileStructure>>(new Map());
    private _selection = writable<Selection>({ type: 'empty' });

    /** Ids of the files in display order. */
    readonly order: Readable<string[]> = { subscribe: this._order.subscribe };
    /** What is currently selected. */
    readonly selection: Readable<Selection> = { subscribe: this._selection.subscribe };
    /** Structure (names, tracks, segments, waypoints and their ids) of each file. */
    readonly structures: Readable<Map<string, FileStructure>> = {
        subscribe: this._structures.subscribe,
    };

    constructor() {
        this.ready = browser
            ? import('gpx-rs').then((wasm) => {
                  wasm.start();
                  this.wasm = wasm;
              })
            : new Promise(() => {});
    }

    // Actions. Each one resolves to whether the engine changed something.

    newFile(name: string) {
        return this.run((w) => w.new_file(name));
    }

    loadFile(data: Uint8Array) {
        return this.run((w) => w.load_file(data));
    }

    duplicate() {
        return this.run((w) => w.duplicate());
    }

    delete() {
        return this.run((w) => w._delete());
    }

    deleteAll() {
        return this.run((w) => w.delete_all());
    }

    undo() {
        return this.run((w) => w.undo());
    }

    redo() {
        return this.run((w) => w.redo());
    }

    select(fileIds: string[]) {
        return this.run((w) => w.select(idsToBytes(fileIds)));
    }

    addSelect(fileIds: string[]) {
        return this.run((w) => w.add_select(idsToBytes(fileIds)));
    }

    selectAll() {
        return this.run((w) => w.select_all());
    }

    /** Moves the files, in the given order, to `index` among the other files. */
    reorder(fileIds: string[], index: number) {
        return this.run((w) => w.reorder(idsToBytes(fileIds), index));
    }

    // Coordinates, as flat [lng, lat, ...] arrays. They are copied out of the WASM memory.
    // Refetch them when the `rev` of the segment (or the `waypointsRev` of the file) changed.

    segmentCoordinates(segmentId: string): Float64Array {
        return this.wasm?.segment_coordinates(segmentId).slice() ?? new Float64Array();
    }

    waypointCoordinates(fileId: string): Float64Array {
        return this.wasm?.waypoint_coordinates(fileId).slice() ?? new Float64Array();
    }

    private async run(action: (wasm: Wasm) => boolean): Promise<boolean> {
        await this.ready;
        const wasm = this.wasm!;
        const changed = action(wasm);
        this.sync(wasm);
        return changed;
    }

    /** Reads what the last action changed. */
    private sync(wasm: Wasm) {
        const update = wasm.last_update();
        if (update.selectionChanged) {
            this._selection.set(wasm.selection());
        }
        if (update.orderChanged) {
            this._order.set(wasm.file_order());
        }
        if (update.added.length + update.modified.length + update.removed.length > 0) {
            this._structures.update((structures) => {
                const next = new Map(structures);
                update.removed.forEach((id) => next.delete(id));
                [...update.added, ...update.modified].forEach((id) => {
                    const structure = wasm.file_structure(id);
                    if (structure) {
                        next.set(id, structure);
                    }
                });
                return next;
            });
        }
    }
}

export const engine = new Engine();
