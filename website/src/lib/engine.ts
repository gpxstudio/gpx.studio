import { browser } from '$app/environment';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { FileColorAllocator, normalizeColor } from '$lib/file-colors';
import { setHidden, type Visibility } from '$lib/file-visibility';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { FileStatistics, FileStructure, Selection } from 'gpx-rs';

export type {
    FileStatistics,
    FileStructure,
    FilesUpdate,
    Selection,
    TrackNode,
    SegmentNode,
    WaypointNode,
} from 'gpx-rs';

type Wasm = typeof import('gpx-rs');

/**
 * How elements combine with the current selection: they `replace` it, are `add`ed to it, or are
 * `toggle`d (the ones already selected are removed). Adding and toggling only merge with elements
 * of the same kind in the same place (same file, same track for segments), otherwise the new
 * elements replace the selection.
 */
export type SelectMode = 'replace' | 'add' | 'toggle';

function selectMode(wasm: Wasm, mode: SelectMode) {
    return {
        replace: wasm.SelectMode.Replace,
        add: wasm.SelectMode.Add,
        toggle: wasm.SelectMode.Toggle,
    }[mode];
}

export type SegmentProperties = {
    fileId: string;
    trackId: string;
    segmentId: string;
    trackIndex: number;
    segmentIndex: number;
    /** Changes when the trackpoints of the segment change. */
    rev: string;
    /** Color of the track, or else the base color of the file. */
    color: string;
    /** Only when the track defines it. */
    opacity?: number;
    width?: number;
};

export type WaypointProperties = {
    fileId: string;
    waypointId: string;
    index: number;
    name?: string;
    sym?: string;
};

/** Everything the UI knows about one file. */
export type FileState = {
    structure: FileStructure;
    /** Color of the file: the one defined by its tracks if any, otherwise one from the palette. */
    color: string;
    /** Global statistics of the file. */
    statistics: FileStatistics;
    /** One LineString feature per track segment, in file order. */
    segments: FeatureCollection<LineString, SegmentProperties>;
    /** One Point feature per waypoint, in file order. */
    waypoints: FeatureCollection<Point, WaypointProperties>;
    /**
     * Visibility the user set explicitly (see `Visibility` and `isHidden`, `isSegmentHidden`,
     * `isWaypointHidden` in `file-visibility`). Hidden elements are still part of the statistics.
     */
    visibility: Visibility;
};

const EMPTY_STATISTICS: FileStatistics = { totalDistance: 0, elevationGain: 0, elevationLoss: 0 };

function toPositions(flat: Float64Array): [number, number][] {
    const positions: [number, number][] = new Array(flat.length / 2);
    for (let i = 0; i < positions.length; i++) {
        positions[i] = [flat[2 * i], flat[2 * i + 1]];
    }
    return positions;
}

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
 * only what the engine reports as changed is read again: the order of the files, and the state
 * of the files that were added or modified. Within a modified file, the GeoJSON features of the
 * segments and waypoints that did not change are reused.
 */
class Engine {
    private wasm: Wasm | null = null;
    /** Resolves once the engine can be used (never on the server). */
    readonly ready: Promise<void>;

    private _order = writable<string[]>([]);
    private _colors = new FileColorAllocator();
    /**
     * Explicit visibility per file. Not dropped with the files: it is back when a deletion is
     * undone. UI state only, it is not part of the engine's history.
     */
    private _visibility = new Map<string, Visibility>();
    private _files = writable<Map<string, Writable<FileState>>>(new Map());
    private _selection = writable<Selection>({ type: 'empty' });

    /** Ids of the files in display order. */
    readonly order: Readable<string[]> = { subscribe: this._order.subscribe };
    /** What is currently selected. */
    readonly selection: Readable<Selection> = { subscribe: this._selection.subscribe };
    /**
     * The state of each file, in its own store. The map store only notifies when files are added
     * or removed; editing a file only notifies the subscribers of that file's store.
     */
    readonly files: Readable<Map<string, Readable<FileState>>> = {
        subscribe: this._files.subscribe,
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

    /**
     * Selects files. Selecting nothing (or only unknown files) deselects everything. See
     * `SelectMode` for how the files combine with the selection.
     */
    select(fileIds: string[], mode: SelectMode = 'replace') {
        return this.run((w) => w.select(idsToBytes(fileIds), selectMode(w, mode)));
    }

    selectAll() {
        return this.select(get(this._order));
    }

    // Selecting elements inside a file. Ids that do not exist are ignored.

    selectTracks(fileId: string, trackIds: string[], mode: SelectMode = 'replace') {
        return this.run((w) => w.select_tracks(fileId, idsToBytes(trackIds), selectMode(w, mode)));
    }

    selectSegments(
        fileId: string,
        trackId: string,
        segmentIds: string[],
        mode: SelectMode = 'replace'
    ) {
        return this.run((w) =>
            w.select_segments(fileId, trackId, idsToBytes(segmentIds), selectMode(w, mode))
        );
    }

    /** Selects the node standing for all the waypoints of the file. */
    selectWaypointGroup(fileId: string, mode: SelectMode = 'replace') {
        return this.run((w) => w.select_waypoint_group(fileId, selectMode(w, mode)));
    }

    selectWaypoints(fileId: string, waypointIds: string[], mode: SelectMode = 'replace') {
        return this.run((w) =>
            w.select_waypoints(fileId, idsToBytes(waypointIds), selectMode(w, mode))
        );
    }

    /** Moves the files, in the given order, to `index` among the other files. */
    reorder(fileIds: string[], index: number) {
        return this.run((w) => w.reorder(idsToBytes(fileIds), index));
    }

    /**
     * Hides or shows elements of a file (see `FileState.visibility`). What was set explicitly
     * below these elements is reset, so that hiding a file then showing one of its segments
     * leaves only that segment visible, and hiding the file again hides all of it.
     */
    setHidden(fileId: string, ids: string[], hidden: boolean) {
        const store = get(this._files).get(fileId);
        if (!store) {
            return;
        }
        const visibility = setHidden(
            get(store).structure,
            this._visibility.get(fileId) ?? new Map(),
            ids,
            hidden
        );
        this._visibility.set(fileId, visibility);
        store.update((state) => ({ ...state, visibility }));
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
        const added: [string, FileState][] = [];
        for (const id of update.added) {
            const state = this.readFile(wasm, id);
            if (state) {
                added.push([id, state]);
            }
        }
        if (added.length > 0 || update.removed.length > 0) {
            this._files.update((files) => {
                const next = new Map(files);
                update.removed.forEach((id) => {
                    next.delete(id);
                    this._colors.release(id);
                });
                added.forEach(([id, state]) => next.set(id, writable(state)));
                return next;
            });
        }
        if (update.modified.length > 0) {
            const files = get(this._files);
            for (const id of update.modified) {
                const store = files.get(id);
                const state = store && this.readFile(wasm, id, get(store));
                if (store && state) {
                    store.set(state);
                }
            }
        }
    }

    /** Reads the state of a file, reusing from `previous` what did not change. */
    private readFile(wasm: Wasm, id: string, previous?: FileState): FileState | null {
        const structure = wasm.file_structure(id);
        if (!structure) {
            return null;
        }

        const color = this._colors.resolve(
            id,
            structure.tracks.map((track) => track.color)
        );

        const previousSegments = new Map(
            previous?.segments.features.map((f) => [f.properties.segmentId, f]) ?? []
        );
        const segments: Feature<LineString, SegmentProperties>[] = [];
        structure.tracks.forEach((track, trackIndex) => {
            track.segments.forEach((segment, segmentIndex) => {
                const properties: SegmentProperties = {
                    fileId: id,
                    trackId: track.id,
                    segmentId: segment.id,
                    trackIndex,
                    segmentIndex,
                    rev: segment.rev,
                    color: track.color !== undefined ? normalizeColor(track.color) : color,
                    opacity: track.opacity,
                    width: track.width,
                };
                const old = previousSegments.get(segment.id);
                const unchanged =
                    old !== undefined &&
                    (Object.keys(properties) as (keyof SegmentProperties)[]).every(
                        (key) => old.properties[key] === properties[key]
                    );
                segments.push(
                    unchanged
                        ? old
                        : {
                              type: 'Feature',
                              geometry: {
                                  type: 'LineString',
                                  coordinates: toPositions(wasm.segment_coordinates(segment.id)),
                              },
                              properties,
                          }
                );
            });
        });

        const previousStructure = previous?.structure;
        const waypointsUnchanged =
            previousStructure !== undefined &&
            previousStructure.waypointsRev === structure.waypointsRev &&
            previousStructure.waypoints.length === structure.waypoints.length &&
            previousStructure.waypoints.every(
                (w, i) =>
                    w.id === structure.waypoints[i].id &&
                    w.name === structure.waypoints[i].name &&
                    w.sym === structure.waypoints[i].sym
            );
        let waypoints = previous?.waypoints;
        if (!waypoints || !waypointsUnchanged) {
            const coordinates = toPositions(wasm.waypoint_coordinates(id));
            waypoints = {
                type: 'FeatureCollection',
                features: structure.waypoints.map((waypoint, index) => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coordinates[index] },
                    properties: {
                        fileId: id,
                        waypointId: waypoint.id,
                        index,
                        name: waypoint.name,
                        sym: waypoint.sym,
                    },
                })),
            };
        }

        return {
            structure,
            color,
            statistics: wasm.file_statistics(id) ?? EMPTY_STATISTICS,
            segments: { type: 'FeatureCollection', features: segments },
            waypoints,
            visibility: this._visibility.get(id) ?? new Map(),
        };
    }
}

export const engine = new Engine();

export type FileStatesCallback = (files: Map<string, Readable<FileState>>) => void;

/**
 * Tells when file stores appear and disappear, so that their subscribers know when to
 * subscribe and unsubscribe. `onFilesAdded` is called with the stores of the new files only
 * (including the ones already present when the observer is created).
 */
export class FileStateCollectionObserver {
    private _fileIds = new Set<string>();
    private _onFilesAdded: FileStatesCallback;
    private _onFileRemoved: (fileId: string) => void;
    private _onDestroy: () => void;
    private _unsubscribe: () => void;

    constructor(
        onFilesAdded: FileStatesCallback,
        onFileRemoved: (fileId: string) => void,
        onDestroy: () => void
    ) {
        this._onFilesAdded = onFilesAdded;
        this._onFileRemoved = onFileRemoved;
        this._onDestroy = onDestroy;

        this._unsubscribe = engine.files.subscribe((files) => {
            this._fileIds.forEach((fileId) => {
                if (!files.has(fileId)) {
                    this._onFileRemoved(fileId);
                    this._fileIds.delete(fileId);
                }
            });
            const newFiles = new Map<string, Readable<FileState>>();
            files.forEach((store, fileId) => {
                if (!this._fileIds.has(fileId)) {
                    newFiles.set(fileId, store);
                    this._fileIds.add(fileId);
                }
            });
            if (newFiles.size > 0) {
                this._onFilesAdded(newFiles);
            }
        });
    }

    destroy() {
        this._onDestroy();
        this._unsubscribe();
    }
}
