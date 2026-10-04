import { browser } from '$app/environment';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { FileColorAllocator, normalizeColor } from '$lib/file-colors';
import { setHidden, type Visibility } from '$lib/file-visibility';
import { selectedElementIds, type FileTreeNode } from '$lib/selection-helpers';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Clipboard, GlobalStatistics, FileStructure, MoveTarget, Selection } from 'gpx-rs';

export type {
    Clipboard,
    MoveTarget,
    GlobalStatistics,
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
    statistics: GlobalStatistics;
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

const EMPTY_STATISTICS: GlobalStatistics = { totalDistance: 0, elevationGain: 0, elevationLoss: 0 };

/**
 * Timestamp of the trackpoints that have none, in `SelectionStatistics.timestamps` (the smallest
 * 64-bit integer, like `NO_TIME` in the engine).
 */
export const NO_TIME = -(2n ** 63n);

/**
 * The statistics of the selection: its global statistics, and the values at each of its
 * trackpoints (all the selected segments, one after the other). The arrays are copies.
 *
 * Distances, times, moving values and elevation gain / loss are cumulative over the whole
 * selection. Distances are in km, speeds in km/h, times in ms (timestamps since the epoch, as
 * 64-bit integers), elevations in m and slopes in %. Missing timestamps are `NO_TIME`, missing
 * measures are NaN.
 */
export type SelectionStatistics = {
    global: GlobalStatistics;
    /** Number of trackpoints. */
    length: number;
    totalDistance: Float64Array;
    movingDistance: Float64Array;
    /** Duration since the start of the selection, in ms. */
    totalTime: BigInt64Array;
    movingTime: BigInt64Array;
    speed: Float64Array;
    elevationGain: Float64Array;
    elevationLoss: Float64Array;
    /** Slope at the trackpoint. */
    slope: Float64Array;
    /** Slope and length (km) of the smoothed elevation segment the trackpoint belongs to. */
    slopeSegmentSlope: Float64Array;
    slopeSegmentDistance: Float64Array;
    lng: Float64Array;
    lat: Float64Array;
    ele: Float64Array;
    timestamps: BigInt64Array;
    hr: Float64Array;
    cad: Float64Array;
    atemp: Float64Array;
    power: Float64Array;
    /**
     * Extensions of the trackpoints (surface, highway...), or an empty array when they are not
     * known. TODO the engine does not store them yet.
     */
    extensions: Record<string, string>[];
    /**
     * Global statistics of the trackpoints from `start` to `end` (both included), for example
     * the part of the elevation profile that was dragged over. `undefined` if the range is not
     * in the selection, or if the selection is not the current one anymore.
     */
    slice(start: number, end: number): GlobalStatistics | undefined;
};

const EMPTY_SELECTION_STATISTICS: SelectionStatistics = {
    global: EMPTY_STATISTICS,
    length: 0,
    totalDistance: new Float64Array(),
    movingDistance: new Float64Array(),
    totalTime: new BigInt64Array(),
    movingTime: new BigInt64Array(),
    speed: new Float64Array(),
    elevationGain: new Float64Array(),
    elevationLoss: new Float64Array(),
    slope: new Float64Array(),
    slopeSegmentSlope: new Float64Array(),
    slopeSegmentDistance: new Float64Array(),
    lng: new Float64Array(),
    lat: new Float64Array(),
    ele: new Float64Array(),
    timestamps: new BigInt64Array(),
    hr: new Float64Array(),
    cad: new Float64Array(),
    atemp: new Float64Array(),
    power: new Float64Array(),
    extensions: [],
    slice: () => undefined,
};

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
    private _canUndo = writable(false);
    private _canRedo = writable(false);
    private _canPaste = writable(false);
    private _clipboard = writable<Clipboard | undefined>(undefined);
    private _statistics = writable<SelectionStatistics>(EMPTY_SELECTION_STATISTICS);
    /** Identifies the statistics currently in the engine's buffers. */
    private _statisticsVersion = 0;

    /** Ids of the files in display order. */
    readonly order: Readable<string[]> = { subscribe: this._order.subscribe };
    /** Statistics of what is currently selected. */
    readonly statistics: Readable<SelectionStatistics> = { subscribe: this._statistics.subscribe };
    readonly canUndo: Readable<boolean> = { subscribe: this._canUndo.subscribe };
    readonly canRedo: Readable<boolean> = { subscribe: this._canRedo.subscribe };
    /** What was copied or cut, waiting to be pasted. */
    readonly clipboard: Readable<Clipboard | undefined> = { subscribe: this._clipboard.subscribe };
    /** Whether the clipboard can be pasted with the current selection. */
    readonly canPaste: Readable<boolean> = { subscribe: this._canPaste.subscribe };
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

    /** `name` is the name of the file when the data has none (the name on disk, without extension). */
    loadFile(data: Uint8Array, name: string) {
        return this.run((w) => w.load_file(data, name));
    }

    duplicate() {
        return this.run((w) => w.duplicate());
    }

    /**
     * Deletes the selected elements. With `wholeFiles`, the files holding the selected elements
     * are deleted instead, even if only a track or a waypoint is selected.
     */
    delete(wholeFiles = false) {
        return this.run((w) => w._delete(wholeFiles));
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

    /**
     * Selects all the elements of the same kind as the selected ones, in the same place: all the
     * files, the tracks of the file, the segments of the track, the waypoints of the file. All
     * the files when nothing is selected.
     */
    selectAll() {
        return this.run((w) => w.select_all());
    }

    /**
     * Moves the selection to the next (`down`) or previous element of the same kind, like the
     * arrow keys do. With `add` (shift + arrow), the element is added to the selection, otherwise
     * it replaces it.
     */
    arrowSelect(down: boolean, add: boolean) {
        return this.run((w) => w.arrow_select(down, add));
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

    /** Selects a node of the file tree. */
    selectNode(node: FileTreeNode, mode: SelectMode = 'replace') {
        switch (node.type) {
            case 'file':
                return this.select([node.fileId], mode);
            case 'track':
                return this.selectTracks(node.fileId, [node.trackId], mode);
            case 'segment':
                return this.selectSegments(node.fileId, node.trackId, [node.segmentId], mode);
            case 'waypoints':
                return this.selectWaypointGroup(node.fileId, mode);
            case 'waypoint':
                return this.selectWaypoints(node.fileId, [node.waypointId], mode);
        }
    }

    // Clipboard

    /** Puts the selected elements in the clipboard. */
    copy() {
        return this.run((w) => w.copy());
    }

    /** Like `copy`, but the elements are moved when they are pasted. */
    cut() {
        return this.run((w) => w.cut());
    }

    /**
     * Pastes the clipboard, depending on the selection: the files, tracks and segments become new
     * files when nothing is selected, tracks and waypoints are added to a selected file,
     * segments to a selected track, and pasted after a selected track, segment or waypoint of the
     * same kind. The pasted elements are selected and the clipboard is emptied.
     */
    paste() {
        return this.run((w) => w.paste());
    }

    /**
     * Moves elements to a place of the file tree, keeping their ids, like dragging and dropping
     * them does. The position of the target counts the elements of its list that are not moved.
     * The moved elements are selected.
     *
     * Files go among the files; tracks among the files (each becomes a file) or the tracks of a
     * file; segments among the files (each becomes a file), the tracks of a file (each becomes a
     * track) or the segments of a track; waypoints, or all the waypoints of a file (the waypoints
     * node), among the waypoints of a file.
     */
    move(what: Selection, to: MoveTarget) {
        return this.run((w) => w.move_elements(what, to));
    }

    // Edits of the selection

    newTrack() {
        return this.run((w) => w.new_track());
    }

    newTrackSegment() {
        return this.run((w) => w.new_track_segment());
    }

    metadata(name: string, desc: string) {
        return this.run((w) => w.metadata(name, desc));
    }

    /** Only the given fields are changed. */
    style(style: { color?: string; opacity?: number; width?: number }) {
        return this.run((w) => w.style(style.color, style.opacity, style.width));
    }

    /** Hides or shows the selected elements. */
    setSelectionHidden(hidden: boolean) {
        selectedElementIds(get(this._selection)).forEach(({ fileId, ids }) =>
            this.setHidden(fileId, ids, hidden)
        );
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
        this._canUndo.set(wasm.can_undo());
        this._canRedo.set(wasm.can_redo());
        this._canPaste.set(wasm.can_paste());
        if (update.clipboardChanged) {
            this._clipboard.set(wasm.clipboard());
        }
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

        // the statistics depend on the selection, on its order, and on the files
        if (
            update.selectionChanged ||
            update.orderChanged ||
            update.added.length + update.modified.length + update.removed.length > 0
        ) {
            this._statistics.set(this.readStatistics(wasm));
        }
    }

    /** Copies the statistics buffers of the engine (they are overwritten by the next action). */
    private readStatistics(wasm: Wasm): SelectionStatistics {
        const version = ++this._statisticsVersion;
        const totalDistance = wasm.total_distance().slice();
        return {
            global: wasm.selection_statistics() ?? EMPTY_STATISTICS,
            length: totalDistance.length,
            totalDistance,
            movingDistance: wasm.moving_distance().slice(),
            totalTime: wasm.total_time().slice(),
            movingTime: wasm.moving_time().slice(),
            speed: wasm.speed().slice(),
            elevationGain: wasm.elevation_gain().slice(),
            elevationLoss: wasm.elevation_loss().slice(),
            slope: wasm.slope().slice(),
            slopeSegmentSlope: wasm.slope_segment_slope().slice(),
            slopeSegmentDistance: wasm.slope_segment_distance().slice(),
            lng: wasm.lng().slice(),
            lat: wasm.lat().slice(),
            ele: wasm.ele().slice(),
            timestamps: wasm.timestamps().slice(),
            hr: wasm.hr().slice(),
            cad: wasm.cad().slice(),
            atemp: wasm.atemp().slice(),
            power: wasm.power().slice(),
            extensions: [],
            slice: (start, end) =>
                version === this._statisticsVersion ? wasm.slice_statistics(start, end) : undefined,
        };
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
