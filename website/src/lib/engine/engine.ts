import { browser } from '$app/environment';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { FileColorAllocator } from '$lib/file-colors';
import {
    setHidden,
    stringifyVisibility,
    VISIBILITY_KEY,
    type Visibility,
} from '$lib/file-visibility';
import { categoryIntervals } from '$lib/trackpoint-categories';
import { selectedElementIds, type FileTreeNode } from '$lib/selection-helpers';
import type { RouteAttributes } from 'gpx-rs';
import { idsToBytes, selectMode, type Wasm } from './convert';
import { readFileState } from './file-state';
import { StatisticsReader } from './statistics';
import { openStoredFiles } from './storage';
import {
    ALL_EXPORT_OPTIONS,
    type Clipboard,
    type ExportOptions,
    type FileState,
    type FilesUpdate,
    type MergeType,
    type MoveTarget,
    type NewWaypoint,
    type Outcome,
    type RoutePoints,
    type Selection,
    type SelectionStatistics,
    type SelectMode,
    type SplitType,
    type StatisticsRequest,
    type TrackpointDetails,
    type WaypointDetails,
} from './types';

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
    private _lastError = writable<string | undefined>(undefined);
    private _canUndo = writable(false);
    private _canRedo = writable(false);
    private _canPaste = writable(false);
    private _clipboard = writable<Clipboard | undefined>(undefined);
    private _statistics = new StatisticsReader(() => this.wasm);

    /** Ids of the files in display order. */
    readonly order: Readable<string[]> = { subscribe: this._order.subscribe };
    /** Statistics of what is currently selected. */
    readonly statistics: Readable<SelectionStatistics> = this._statistics.store;
    readonly canUndo: Readable<boolean> = { subscribe: this._canUndo.subscribe };
    readonly canRedo: Readable<boolean> = { subscribe: this._canRedo.subscribe };
    /** Why the last call to the engine did nothing, `undefined` if it did something. */
    readonly lastError: Readable<string | undefined> = { subscribe: this._lastError.subscribe };
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

    // Storage

    private _storage?: Promise<Record<string, string>>;

    /**
     * Opens the storage of the browser: the files that it holds are put in the engine, and the
     * changes of the files are kept from then on. Resolves to the settings, as JSON strings by
     * key. Only the app does it (the embedded map has no files of its own), once.
     *
     * The first time, what the previous versions of the app kept in the browser is imported.
     */
    openStorage(): Promise<Record<string, string>> {
        this._storage ??= this.ready.then(() =>
            openStoredFiles({
                wasm: this.wasm!,
                visibility: this._visibility,
                sync: (update) => this.sync(this.wasm!, update),
                hasFiles: () => get(this._order).length > 0,
                loadFiles: (files) => this.loadFiles(files),
                deselect: () => this.select([]),
            })
        );
        return this._storage;
    }

    /** Keeps a setting, `json` being its JSON. Nothing is kept before `openStorage` is done. */
    setSetting(key: string, json: string) {
        this.wasm?.set_setting(key, json);
    }

    deleteSetting(key: string) {
        this.wasm?.delete_setting(key);
    }

    // Actions. Each one resolves to whether the engine changed something.

    /**
     * Creates a file, which gets selected. With a `trackpoint`, the file starts with a track and a
     * segment that hold it, in the same undo step.
     */
    newFile(name: string, trackpoint?: { lng: number; lat: number; ele?: number }) {
        return this.run((w) => w.new_file(name, trackpoint?.lng, trackpoint?.lat, trackpoint?.ele));
    }

    /**
     * Loads files as a single command (one undo step). `name` is the name of a file when its data
     * has none (the name on disk, without extension). The files that cannot be read are skipped,
     * the first one that was read is selected.
     */
    loadFiles(files: { data: Uint8Array; name: string }[]) {
        const lengths = Uint32Array.from(files.map((file) => file.data.length));
        const data = new Uint8Array(lengths.reduce((sum, length) => sum + length, 0));
        let offset = 0;
        for (const file of files) {
            data.set(file.data, offset);
            offset += file.data.length;
        }
        return this.run((w) =>
            w.load_files(
                data,
                lengths,
                files.map((file) => file.name)
            )
        );
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
     * same kind. The pasted elements are selected.
     *
     * What is pasted is always the elements as they were when they were copied or cut, even if
     * they were changed or deleted since. It can be pasted several times: what was copied is
     * copied again, what was cut is moved the first time and copied after that.
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

    // Waypoints

    /** All the data of a waypoint, `undefined` if it does not exist (or before the engine is loaded). */
    waypoint(fileId: string, waypointId: string): WaypointDetails | undefined {
        return this.wasm?.waypoint(fileId, waypointId);
    }

    /**
     * Adds a waypoint to each selected file (or to the file of the selected elements). Empty
     * strings are fields that the waypoint does not have.
     */
    newWaypoint(waypoint: NewWaypoint) {
        return this.run((w) =>
            w.new_waypoint(
                waypoint.lng,
                waypoint.lat,
                waypoint.ele,
                waypoint.name,
                waypoint.desc,
                waypoint.icon,
                waypoint.link
            )
        );
    }

    /** Changes a waypoint, selected or not. Empty strings remove the field. */
    updateWaypoint(fileId: string, waypointId: string, waypoint: NewWaypoint) {
        return this.run((w) =>
            w.update_waypoint(
                fileId,
                waypointId,
                waypoint.lng,
                waypoint.lat,
                waypoint.ele,
                waypoint.name,
                waypoint.desc,
                waypoint.icon,
                waypoint.link
            )
        );
    }

    /** Moves a waypoint, selected or not: only its position and elevation change. */
    moveWaypoint(fileId: string, waypointId: string, lng: number, lat: number, ele: number) {
        return this.run((w) => w.move_waypoint(fileId, waypointId, lng, lat, ele));
    }

    /** Deletes a waypoint, selected or not. */
    deleteWaypoint(fileId: string, waypointId: string) {
        return this.run((w) => w.delete_waypoint(fileId, waypointId));
    }

    /**
     * Removes the trackpoints and/or waypoints of the selection inside (or outside) a rectangle.
     * Resolves to `false` when nothing was removed.
     */
    clean(
        bounds: { west: number; south: number; east: number; north: number },
        inside: boolean,
        trackpoints: boolean,
        waypoints: boolean
    ) {
        return this.run((w) =>
            w.clean(
                bounds.west,
                bounds.south,
                bounds.east,
                bounds.north,
                inside ? w.CleanType.Inside : w.CleanType.Outside,
                trackpoints,
                waypoints
            )
        );
    }

    /**
     * Replaces the trackpoints `start` to `end` (excluded) of the selection by `points` (a pure
     * insertion if `start === end`, a pure removal without points), in a single segment: the
     * indices are the ones of `SelectionAnchors`, and `revision` the one they were read with. The
     * indices in `anchors`, among the new points, become anchors of the routing tool. Resolves to
     * `false` if the selection changed since the revision, or if the range is not valid.
     */
    route(
        revision: number,
        start: number,
        end: number,
        points: RoutePoints,
        anchors: readonly number[] = []
    ) {
        const attributes = (values?: readonly (string | undefined)[]) =>
            values && { ...categoryIntervals(values) };
        const routeAttributes: RouteAttributes = {};
        for (const [key, values] of [
            ['surface', points.surface],
            ['highway', points.highway],
            ['sacScale', points.sacScale],
            ['mtbScale', points.mtbScale],
        ] as const) {
            const intervals = attributes(values);
            if (intervals && intervals.names.length > 0) {
                routeAttributes[key] = intervals;
            }
        }
        return this.run((w) =>
            w.route(
                revision,
                start,
                end,
                Float64Array.from(points.lng),
                Float64Array.from(points.lat),
                Float64Array.from(points.ele),
                routeAttributes,
                Uint32Array.from(anchors)
            )
        );
    }

    /**
     * Makes an anchor of the point of the selected segments that is the closest to the
     * coordinates, inserting a trackpoint on the path if there is none there. `revision` is the
     * one of `SelectionAnchors`.
     */
    insertAnchor(revision: number, lng: number, lat: number) {
        return this.run((w) => w.insert_anchor(revision, lng, lat));
    }

    /**
     * Makes the trackpoint `index` of the selection the start of its segment, which is a loop:
     * the trackpoints before it go to the end, and the loop closes on it. `revision` is the one of `SelectionAnchors`.
     */
    changeLoopStart(revision: number, index: number) {
        return this.run((w) => w.change_loop_start(revision, index));
    }

    /** A trackpoint of a segment, `undefined` if it does not exist. */
    trackpoint(fileId: string, segmentId: string, index: number): TrackpointDetails | undefined {
        return this.wasm?.trackpoint(fileId, segmentId, index);
    }

    // Edits of the selection

    newTrack() {
        return this.run((w) => w.new_track());
    }

    newTrackSegment() {
        return this.run((w) => w.new_track_segment());
    }

    /**
     * Reverses the direction of the selection: the whole of each selected file or track, or each
     * selected segment on its own. The timestamps are mirrored. Resolves to `false` when there is
     * nothing to reverse (fewer than two trackpoints).
     */
    reverse() {
        return this.run((w) => w.reverse());
    }

    /**
     * Splits the selected files and tracks that have several segments into elements that have
     * one each (one file per track or per segment, one track per segment), which get selected.
     * Resolves to `false` when there is nothing to extract.
     */
    extract() {
        return this.run((w) => w.extract());
    }

    /**
     * Sets the elevation of the trackpoints of the selection, one elevation (m) per trackpoint, in
     * the order of the statistics. Resolves to `false` when there is nothing to set, or when the
     * number of elevations is not the number of trackpoints.
     */
    setElevation(ele: Float64Array) {
        return this.run((w) => w.elevation(ele));
    }

    /**
     * Sets the timestamps of the selection, which starts at `startTime`: the trackpoints that
     * have some keep their durations multiplied by `ratio`, the others follow the previous one at
     * `speed` (km/h). Resolves to `false` when there is nothing to set, or the values are invalid.
     */
    changeTimestamps(startTime: Date, speed: number, ratio: number) {
        return this.run((w) => w.changeTimestamps(startTime.getTime(), speed, ratio));
    }

    /**
     * Makes up timestamps for the selection, which starts at `startTime` and lasts `totalTime`
     * seconds, longer and steeper intervals taking more time. Resolves to `false` when there is
     * nothing to set.
     */
    createArtificialTimestamps(startTime: Date, totalTime: number) {
        return this.run((w) => w.createArtificialTimestamps(startTime.getTime(), totalTime));
    }

    /**
     * A file as GPX (UTF-8 bytes), `undefined` if it does not exist. The options say which data of the
     * trackpoints to keep.
     */
    exportFile(
        fileId: string,
        options: ExportOptions = ALL_EXPORT_OPTIONS
    ): Uint8Array<ArrayBuffer> | undefined {
        // a copy out of the memory of the engine, so a plain ArrayBuffer
        return this.wasm?.export_file(
            fileId,
            options.time,
            options.hr,
            options.cad,
            options.atemp,
            options.power,
            options.osm
        ) as Uint8Array<ArrayBuffer> | undefined;
    }

    /** The data that some files have, which the options of `exportFile` can leave out. */
    exportableData(fileIds: string[]): ExportOptions {
        const bits = this.wasm?.exportable_data(idsToBytes(fileIds)) ?? 0;
        return {
            time: (bits & 1) !== 0,
            hr: (bits & 2) !== 0,
            cad: (bits & 4) !== 0,
            atemp: (bits & 8) !== 0,
            power: (bits & 16) !== 0,
            osm: (bits & 32) !== 0,
        };
    }

    /**
     * Merges the selected files, tracks or segments into the first of them (see `MergeType`). With
     * `removeGaps`, the parts that are connected get closer in time if they have timestamps.
     * Resolves to `false` when there is nothing to merge.
     */
    merge(type: MergeType, removeGaps = false) {
        return this.run((w) =>
            w.merge(type === 'connect' ? w.MergeType.Connect : w.MergeType.Group, removeGaps)
        );
    }

    /**
     * Removes the trackpoints of the selection that are less than `tolerance` meters away from the
     * line of their neighbours, except the ends of the segments. Resolves to `false` when there
     * is nothing to remove.
     */
    reduce(tolerance: number) {
        return this.run((w) => w.reduce(tolerance));
    }

    /**
     * For each trackpoint of the selection, in the order of the statistics, the highest tolerance
     * (m) of `reduce` that keeps it: infinite for the ends of the segments. Not requested with
     * the statistics: ask when they changed.
     */
    reductionDistances(): Float64Array {
        return this.wasm?.reduction_distances() ?? new Float64Array();
    }

    /**
     * Cuts the file, the track or the segment (see `SplitType`) of the trackpoint `at` of the
     * selection in two, there: the trackpoint ends the first part and starts the second one. The
     * first part keeps the ids, the second one (and what follows) gets new ones. `revision` is the
     * one of `SelectionAnchors`, which `at` is an index of.
     */
    split(revision: number, at: number, splitType: SplitType) {
        return this.run((w) =>
            w.split(
                revision,
                at,
                {
                    files: w.SplitType.Files,
                    tracks: w.SplitType.Tracks,
                    segments: w.SplitType.Segments,
                }[splitType]
            )
        );
    }

    /**
     * Keeps the trackpoints `start` to `end` (both included) of the selection, counted over its
     * segments one after the other, and removes the others, with the segments, tracks and files
     * that are left empty (tracks and files only if they are selected). Resolves to `false` when
     * the range covers the whole selection.
     */
    crop(start: number, end: number) {
        return this.run((w) => w.crop(Math.max(start, 0), Math.max(end, 0)));
    }

    /**
     * Makes each selected segment (or the segments of the selected files and tracks) come back to
     * where it started: a reversed copy of it is added after its last trackpoint (which is not
     * repeated), and goes on in time. Resolves to `false` when no segment has the two trackpoints that a way back needs.
     */
    roundTrip() {
        return this.run((w) => w.round_trip());
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
        this.saveVisibility();
    }

    /** Keeps what is hidden, for the files that exist (the others are not coming back). */
    private saveVisibility() {
        const files = get(this._files);
        const json = stringifyVisibility(this._visibility, (fileId) => files.has(fileId));
        if (json === undefined) {
            this.deleteSetting(VISIBILITY_KEY);
        } else {
            this.setSetting(VISIBILITY_KEY, json);
        }
    }

    // Coordinates, as flat [lng, lat, ...] arrays. The getters copy them out of the WASM memory.
    // Refetch them when the `rev` of the segment (or the `waypointsRev` of the file) changed.

    segmentCoordinates(segmentId: string): Float64Array {
        return this.wasm?.segment_coordinates(segmentId) ?? new Float64Array();
    }

    waypointCoordinates(fileId: string): Float64Array {
        return this.wasm?.waypoint_coordinates(fileId) ?? new Float64Array();
    }

    /**
     * Makes a call to the engine and applies its outcome to what is kept of the files. Resolves to
     * whether anything changed. When nothing did, `lastError` tells why.
     */
    private async run(action: (wasm: Wasm) => Outcome): Promise<boolean> {
        await this.ready;
        const wasm = this.wasm!;
        const outcome = action(wasm);
        this.sync(wasm, outcome);
        this.report(outcome);
        return outcome.changed;
    }

    /** Logs why a call did nothing, and keeps it in `lastError`. */
    private report(outcome: Outcome) {
        this._lastError.set(outcome.error);
        if (outcome.error === 'nothing to do') {
            console.debug('engine:', outcome.error);
        } else if (outcome.error !== undefined) {
            console.warn('engine:', outcome.error);
        }
    }

    /**
     * Registers a consumer of the statistics that needs some of the metrics that are not part of
     * them by default (see `StatisticsMetric`). The metrics asked for by all the consumers are
     * added to `statistics`: the ones that are missing are read right away, and then after each
     * change of the selection or of the files, and the store is updated. Call `release` when the
     * consumer goes away.
     */
    requestStatistics(): StatisticsRequest {
        return this._statistics.request();
    }

    /** Updates what is kept of the engine with what a call changed. */
    private sync(wasm: Wasm, update: FilesUpdate) {
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
            const state = readFileState(wasm, id, this._colors, this._visibility);
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
                const state =
                    store && readFileState(wasm, id, this._colors, this._visibility, get(store));
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
            this._statistics.refresh(wasm);
        }
    }
}

export const engine = new Engine();
