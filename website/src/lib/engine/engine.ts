import { browser } from '$app/environment';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { FileColorAllocator } from '$lib/engine/file-colors';
import {
    setHidden,
    stringifyVisibility,
    VISIBILITY_KEY,
    type Visibility,
} from '$lib/engine/file-visibility';
import { categoryIntervals } from '$lib/engine/trackpoint-categories';
import { selectedElementIds, type FileTreeNode } from '$lib/engine/selection-helpers';
import type { RouteAttributes } from 'gpx-wasm';
import { loadBackend, type Backend } from './backend';
import type { DesktopFiles } from './backend/types';
import { readFileState } from './file-state';
import { StatisticsReader } from './statistics';
import { openStoredFiles } from './storage';
import {
    ALL_EXPORT_OPTIONS,
    type Clipboard,
    type ExportOptions,
    type FileState,
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
    type FolderEntry,
    type UnsavedChoice,
    type WorkspaceState,
    type TrackpointDetails,
    type WaypointDetails,
} from './types';

/**
 * Thin wrapper around the engine of the files (the WASM module in the browser, the Rust process
 * in the desktop app: see `backend`).
 *
 * The engine owns the files; this class mirrors what the UI needs in stores. After each action,
 * only what the engine reports as changed is read again: the order of the files, and the state
 * of the files that were added or modified. Within a modified file, the GeoJSON features of the
 * segments and waypoints that did not change are reused.
 */
class Engine {
    private backend: Backend | null = null;
    /** The calls to the engine, one after the other: each one is applied before the next starts. */
    private _queue: Promise<unknown> = Promise.resolve();
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
    private _outdated = writable(false);
    private _workspace = writable<WorkspaceState | undefined>(undefined);
    private _folderVersion = writable(0);
    private _canUndo = writable(false);
    private _canRedo = writable(false);
    private _canPaste = writable(false);
    private _clipboard = writable<Clipboard | undefined>(undefined);
    private _statistics = new StatisticsReader((task) => this.enqueue(task));

    /** Ids of the files in display order. */
    readonly order: Readable<string[]> = { subscribe: this._order.subscribe };
    /** Statistics of what is currently selected. */
    readonly statistics: Readable<SelectionStatistics> = this._statistics.store;
    /** Whether the stored files are from a newer version of the app: changes are not kept, the page has to be reloaded. */
    readonly outdated: Readable<boolean> = { subscribe: this._outdated.subscribe };
    readonly canUndo: Readable<boolean> = { subscribe: this._canUndo.subscribe };
    readonly canRedo: Readable<boolean> = { subscribe: this._canRedo.subscribe };
    /**
     * Where the files are on the file system, and which ones have edits that are not saved there.
     * `undefined` unless the files are linked to the file system (the desktop app).
     */
    readonly workspace: Readable<WorkspaceState | undefined> = {
        subscribe: this._workspace.subscribe,
    };
    /**
     * A number that changes when something changed in the open folder on the file system, to read
     * its tree again.
     */
    readonly folderVersion: Readable<number> = { subscribe: this._folderVersion.subscribe };
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
            ? loadBackend().then(async (backend) => {
                  this.backend = backend;
                  await this.followDisk(backend);
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
                backend: this.backend!,
                visibility: this._visibility,
                sync: (update) => this.enqueue(() => this.sync(this.backend!, update)),
                outdated: () => this._outdated.set(true),
                hasFiles: () => get(this._order).length > 0,
                loadFiles: (files) => this.loadFiles(files),
                deselect: () => this.select([]),
            })
        );
        return this._storage;
    }

    /** Keeps a setting, `json` being its JSON. Nothing is kept before `openStorage` is done. */
    setSetting(key: string, json: string) {
        void this.backend?.set_setting(key, json);
    }

    deleteSetting(key: string) {
        void this.backend?.delete_setting(key);
    }

    // Selection. Like the edits, each action resolves to whether the engine changed something.

    /**
     * Selects files. Selecting nothing (or only unknown files) deselects everything. See
     * `SelectMode` for how the files combine with the selection.
     */
    select(fileIds: string[], mode: SelectMode = 'replace') {
        return this.run((b) => b.select(fileIds, mode));
    }

    /**
     * Selects all the elements of the same kind as the selected ones, in the same place: all the
     * files, the tracks of the file, the segments of the track, the waypoints of the file. All
     * the files when nothing is selected.
     */
    selectAll() {
        return this.run((b) => b.select_all());
    }

    /**
     * Moves the selection to the next (`down`) or previous element of the same kind, like the
     * arrow keys do. With `add` (shift + arrow), the element is added to the selection, otherwise
     * it replaces it.
     */
    arrowSelect(down: boolean, add: boolean) {
        return this.run((b) => b.arrow_select(down, add));
    }

    // Selecting elements inside a file. Ids that do not exist are ignored.

    selectTracks(fileId: string, trackIds: string[], mode: SelectMode = 'replace') {
        return this.run((b) => b.select_tracks(fileId, trackIds, mode));
    }

    selectSegments(
        fileId: string,
        trackId: string,
        segmentIds: string[],
        mode: SelectMode = 'replace'
    ) {
        return this.run((b) => b.select_segments(fileId, trackId, segmentIds, mode));
    }

    /** Selects the node standing for all the waypoints of the file. */
    selectWaypointGroup(fileId: string, mode: SelectMode = 'replace') {
        return this.run((b) => b.select_waypoint_group(fileId, mode));
    }

    selectWaypoints(fileId: string, waypointIds: string[], mode: SelectMode = 'replace') {
        return this.run((b) => b.select_waypoints(fileId, waypointIds, mode));
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

    // History

    undo() {
        return this.run((b) => b.undo());
    }

    redo() {
        return this.run((b) => b.redo());
    }

    // Clipboard

    /** Puts the selected elements in the clipboard. */
    copy() {
        return this.run((b) => b.copy());
    }

    /** Like `copy`, but the elements are moved when they are pasted. */
    cut() {
        return this.run((b) => b.cut());
    }

    // Edits of the files

    /**
     * Creates a file, which gets selected. With a `trackpoint`, the file starts with a track and a
     * segment that hold it, in the same undo step.
     */
    newFile(name: string, trackpoint?: { lng: number; lat: number; ele?: number }) {
        return this.run((b) => b.new_file(name, trackpoint?.lng, trackpoint?.lat, trackpoint?.ele));
    }

    /**
     * Loads files as a single command (one undo step). `name` is the name of a file when its data
     * has none (the name on disk, without extension). The files that cannot be read are skipped,
     * the first one that was read is selected.
     */
    loadFiles(files: { data: Uint8Array; name: string }[]) {
        return this.run((b) => b.load_files(files));
    }

    duplicate() {
        return this.run((b) => b.duplicate());
    }

    /**
     * Deletes the selected elements. With `wholeFiles`, the files holding the selected elements
     * are deleted instead, even if only a track or a waypoint is selected.
     */
    delete(wholeFiles = false) {
        return this.run((b) => b.delete(wholeFiles));
    }

    deleteAll() {
        return this.run((b) => b.delete_all());
    }

    /** Moves the files, in the given order, to `index` among the other files. */
    reorder(fileIds: string[], index: number) {
        return this.run((b) => b.reorder(fileIds, index));
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
        return this.run((b) => b.paste());
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
        return this.run((b) => b.move_elements(what, to));
    }

    // Edits of the waypoints

    /**
     * Adds a waypoint to each selected file (or to the file of the selected elements). Empty
     * strings are fields that the waypoint does not have.
     */
    newWaypoint(waypoint: NewWaypoint) {
        return this.run((b) =>
            b.new_waypoint(
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
        return this.run((b) =>
            b.update_waypoint(
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
        return this.run((b) => b.move_waypoint(fileId, waypointId, lng, lat, ele));
    }

    /** Deletes a waypoint, selected or not. */
    deleteWaypoint(fileId: string, waypointId: string) {
        return this.run((b) => b.delete_waypoint(fileId, waypointId));
    }

    // Edits of the selection

    newTrack() {
        return this.run((b) => b.new_track());
    }

    newTrackSegment() {
        return this.run((b) => b.new_track_segment());
    }

    /**
     * Reverses the direction of the selection: the whole of each selected file or track, or each
     * selected segment on its own. The timestamps are mirrored. Resolves to `false` when there is
     * nothing to reverse (fewer than two trackpoints).
     */
    reverse() {
        return this.run((b) => b.reverse());
    }

    /**
     * Splits the selected files and tracks that have several segments into elements that have
     * one each (one file per track or per segment, one track per segment), which get selected.
     * Resolves to `false` when there is nothing to extract.
     */
    extract() {
        return this.run((b) => b.extract());
    }

    /**
     * Sets the elevation of the trackpoints of the selection, one elevation (m) per trackpoint, in
     * the order of the statistics. Resolves to `false` when there is nothing to set, or when the
     * number of elevations is not the number of trackpoints.
     */
    setElevation(ele: Float64Array) {
        return this.run((b) => b.elevation(ele));
    }

    /**
     * Sets the timestamps of the selection, which starts at `startTime`: the trackpoints that
     * have some keep their durations multiplied by `ratio`, the others follow the previous one at
     * `speed` (km/h). Resolves to `false` when there is nothing to set, or the values are invalid.
     */
    changeTimestamps(startTime: Date, speed: number, ratio: number) {
        return this.run((b) => b.change_timestamps(startTime.getTime(), speed, ratio));
    }

    /**
     * Makes up timestamps for the selection, which starts at `startTime` and lasts `totalTime`
     * seconds, longer and steeper intervals taking more time. Resolves to `false` when there is
     * nothing to set.
     */
    createArtificialTimestamps(startTime: Date, totalTime: number) {
        return this.run((b) => b.create_artificial_timestamps(startTime.getTime(), totalTime));
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
        return this.run((b) =>
            b.clean(
                bounds.west,
                bounds.south,
                bounds.east,
                bounds.north,
                inside,
                trackpoints,
                waypoints
            )
        );
    }

    /**
     * Merges the selected files, tracks or segments into the first of them (see `MergeType`). With
     * `removeGaps`, the parts that are connected get closer in time if they have timestamps.
     * Resolves to `false` when there is nothing to merge.
     */
    merge(type: MergeType, removeGaps = false) {
        return this.run((b) => b.merge(type, removeGaps));
    }

    /**
     * Removes the trackpoints of the selection that are less than `tolerance` meters away from the
     * line of their neighbours, except the ends of the segments. Resolves to `false` when there
     * is nothing to remove.
     */
    reduce(tolerance: number) {
        return this.run((b) => b.reduce(tolerance));
    }

    /**
     * Cuts the file, the track or the segment (see `SplitType`) of the trackpoint `at` of the
     * selection in two, there: the trackpoint ends the first part and starts the second one. The
     * first part keeps the ids, the second one (and what follows) gets new ones. `revision` is the
     * one of `SelectionAnchors`, which `at` is an index of.
     */
    split(revision: number, at: number, splitType: SplitType) {
        return this.run((b) => b.split(revision, at, splitType));
    }

    /**
     * Keeps the trackpoints `start` to `end` (both included) of the selection, counted over its
     * segments one after the other, and removes the others, with the segments, tracks and files
     * that are left empty (tracks and files only if they are selected). Resolves to `false` when
     * the range covers the whole selection.
     */
    crop(start: number, end: number) {
        return this.run((b) => b.crop(Math.max(start, 0), Math.max(end, 0)));
    }

    /**
     * Makes each selected segment (or the segments of the selected files and tracks) come back to
     * where it started: a reversed copy of it is added after its last trackpoint (which is not
     * repeated), and goes on in time. Resolves to `false` when no segment has the two trackpoints that a way back needs.
     */
    roundTrip() {
        return this.run((b) => b.round_trip());
    }

    metadata(name: string, desc: string) {
        return this.run((b) => b.metadata(name, desc));
    }

    /** Only the given fields are changed. */
    style(style: { color?: string; opacity?: number; width?: number }) {
        return this.run((b) => b.style(style.color, style.opacity, style.width));
    }

    // Routing

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
        return this.run((b) =>
            b.route(
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
        return this.run((b) => b.insert_anchor(revision, lng, lat));
    }

    /**
     * Makes the trackpoint `index` of the selection the start of its segment, which is a loop:
     * the trackpoints before it go to the end, and the loop closes on it. `revision` is the one of `SelectionAnchors`.
     */
    changeLoopStart(revision: number, index: number) {
        return this.run((b) => b.change_loop_start(revision, index));
    }

    // The file system (the desktop app)

    /**
     * Opens the files that the user picks on the file system, which get selected. Resolves to the
     * ids of the files that were added.
     */
    async openFiles(): Promise<string[]> {
        return this.addedBy((b) => b.desktop!.openFiles());
    }

    /**
     * Opens files of the file system by their path, which get selected: as a preview with
     * `preview`, see `DesktopFiles.openPaths`. Resolves to the new ids.
     */
    async openPaths(paths: string[], preview = false): Promise<string[]> {
        const added = await this.addedBy((b) => b.desktop!.openPaths(paths, preview));
        // which file is the preview may have changed, without a file changing
        await this.enqueue(async () => this.refreshWorkspace(this.backend!));
        return added;
    }

    // What the explorer does to the tree of the open folder (the desktop app). When it fails,
    // `lastError` tells why (a key of the dictionaries, or a message).

    /**
     * Makes a new file in a folder of the open folder, which is written there at once and selected.
     * Resolves to its id.
     */
    async newFileIn(name: string, folder: string): Promise<string | undefined> {
        const [id] = await this.addedBy((b) => b.desktop!.newFile(name, folder));
        this._folderVersion.update((version) => version + 1);
        return id;
    }

    /** Makes a folder in a folder of the open folder: resolves to its path. */
    async createFolder(parent: string, name: string): Promise<string | undefined> {
        return (await this.treeOperation((desktop) => desktop.createFolder(parent, name))).value;
    }

    /** Renames a file or a folder of the open folder. Resolves to whether it was done. */
    async renamePath(path: string, name: string): Promise<boolean> {
        const changed = await this.run((b) => b.desktop!.renamePath(path, name));
        const failed = get(this._lastError) !== undefined;
        await this.treeOperation(async () => {});
        return changed || !failed;
    }

    /** Moves files and folders of the open folder into a folder of it. */
    async movePaths(paths: string[], folder: string): Promise<boolean> {
        return (await this.treeOperation((desktop) => desktop.movePaths(paths, folder))).done;
    }

    /** Moves files and folders of the open folder to the trash. */
    async deletePaths(paths: string[]): Promise<boolean> {
        const changed = await this.run((b) => b.desktop!.deletePaths(paths));
        const failed = get(this._lastError) !== undefined;
        await this.treeOperation(async () => {});
        return changed || !failed;
    }

    /** Shows a file or a folder in the file manager of the system. */
    async revealPath(path: string) {
        await this.ready;
        try {
            await this.backend!.desktop?.revealPath(path);
        } catch (error) {
            console.error('engine:', error);
        }
    }

    /**
     * Does something to the file system, then reads where the files are and the tree again
     * (without waiting for the watcher). Resolves to whether it was done, with what it gives.
     */
    private async treeOperation<T>(
        action: (desktop: DesktopFiles) => Promise<T>
    ): Promise<{ done: boolean; value?: T }> {
        await this.ready;
        return this.enqueue(async () => {
            const backend = this.backend!;
            let result: { done: boolean; value?: T } = { done: false };
            try {
                result = { done: true, value: await action(backend.desktop!) };
            } catch (error) {
                console.error('engine:', error);
                this._lastError.set(String(error));
            }
            await this.refreshWorkspace(backend);
            this._folderVersion.update((version) => version + 1);
            return result;
        });
    }

    /**
     * Opens the folder that the user picks (instead of the one that was open, which is closed with
     * its files like `closeFiles` does, `unsaved` being what to do with the unsaved ones). The
     * folder is watched, and its tree is read with `listFolder`: its files are not opened.
     */
    async openFolder(unsaved?: UnsavedChoice) {
        await this.run((b) => b.desktop!.openFolder(unsaved));
        await this.enqueue(async () => this.refreshWorkspace(this.backend!));
    }

    /** Closes the open folder and all the files: see `closeFiles` for `unsaved`. */
    async closeFolder(unsaved?: UnsavedChoice) {
        await this.run((b) => b.desktop!.closeFolder(unsaved));
        await this.enqueue(async () => this.refreshWorkspace(this.backend!));
    }

    /**
     * Closes files. `unsaved` says what to do with the ones that have unsaved edits: they are saved
     * first, or their edits are lost (they stay open when it is not said).
     */
    async closeFiles(fileIds: string[], unsaved?: UnsavedChoice) {
        await this.run((b) => b.desktop!.closeFiles(fileIds, unsaved));
        await this.enqueue(async () => this.refreshWorkspace(this.backend!));
    }

    /**
     * Writes files to the file system, replacing what is there; they are not edited anymore from
     * then on. The user is asked where to put the ones that have no place yet. Resolves to false
     * when the user cancelled or the files could not be saved.
     */
    async save(fileIds: string[]): Promise<boolean> {
        return this.desktopCall((desktop) => desktop.saveFiles(fileIds));
    }

    /** Writes a file where the user says, which is where it is from then on. */
    async saveAs(fileId: string): Promise<boolean> {
        return this.desktopCall((desktop) => desktop.saveFileAs(fileId));
    }

    /** Writes copies of files where the user says. The files stay as they are. */
    async exportFiles(fileIds: string[], options: ExportOptions): Promise<boolean> {
        return this.desktopCall((desktop) => desktop.exportFiles(fileIds, options));
    }

    /** Reads files again from the file system: their edits are lost (one undo step). */
    async reload(fileIds: string[]) {
        await this.run((b) => b.desktop!.reloadFiles(fileIds));
        await this.enqueue(async () => this.refreshWorkspace(this.backend!));
    }

    /** Opens a web page in the browser of the system (the desktop app). */
    async openUrl(url: string) {
        await this.ready;
        try {
            await this.backend!.desktop?.openUrl(url);
        } catch (error) {
            console.error('The page could not be opened', error);
        }
    }

    /** The folders and GPX files in a folder of the open folder (the open folder by default). */
    async listFolder(path?: string): Promise<FolderEntry[]> {
        await this.ready;
        return this.enqueue(async () => {
            try {
                return await this.backend!.desktop!.listFolder(path);
            } catch (error) {
                console.error('The folder could not be read', error);
                return [];
            }
        });
    }

    /** Calls the file system of the desktop app, and keeps the status of the files up to date. */
    private async desktopCall(call: (desktop: DesktopFiles) => Promise<boolean>): Promise<boolean> {
        await this.ready;
        return this.enqueue(async () => {
            const backend = this.backend!;
            let done = false;
            try {
                done = await call(backend.desktop!);
            } catch (error) {
                console.error('The files could not be written', error);
                this._lastError.set(String(error));
            }
            await this.refreshWorkspace(backend);
            return done;
        });
    }

    /** Runs a call that adds files, and resolves to the ids that it added. */
    private async addedBy(action: (backend: Backend) => Promise<Outcome>): Promise<string[]> {
        const before = new Set(get(this._order));
        await this.run(action);
        return get(this._order).filter((id) => !before.has(id));
    }

    private _opened: ((ids: string[]) => void)[] = [];

    /**
     * Calls `callback` with the ids of the files that were added when the system opens files with
     * the app (open with..., double click), which is already running to receive them. Returns what
     * stops it.
     */
    onFilesOpened(callback: (ids: string[]) => void): () => void {
        this._opened.push(callback);
        return () => {
            this._opened = this._opened.filter((other) => other !== callback);
        };
    }

    private async refreshWorkspace(backend: Backend) {
        if (backend.desktop) {
            this._workspace.set(await backend.desktop.workspace());
        }
    }

    /**
     * Follows what happens on the file system when it is not the user who does it: the files that
     * changed on the disk are brought in the engine, which says so.
     */
    private async followDisk(backend: Backend) {
        if (!backend.desktop) {
            return;
        }
        this._workspace.set(await backend.desktop.workspace());
        await backend.desktop.listen(
            (outcome) =>
                void this.enqueue(async () => {
                    await this.sync(backend, outcome);
                    this.report(outcome);
                }),
            (workspace) => this._workspace.set(workspace),
            (outcome) =>
                void this.enqueue(async () => {
                    await this.sync(backend, outcome);
                    this.report(outcome);
                    this._opened.forEach((callback) => callback(outcome.added));
                }),
            () => this._folderVersion.update((version) => version + 1)
        );
    }

    // Visibility, which is kept by the frontend and not by the engine

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

    // Requests, which do not change anything. They wait for the calls made before them.

    /** All the data of a waypoint, `undefined` if it does not exist (or before the engine is loaded). */
    waypoint(fileId: string, waypointId: string): Promise<WaypointDetails | undefined> {
        return this.read((b) => b.waypoint(fileId, waypointId), undefined);
    }

    /** A trackpoint of a segment, `undefined` if it does not exist. */
    trackpoint(
        fileId: string,
        segmentId: string,
        index: number
    ): Promise<TrackpointDetails | undefined> {
        return this.read((b) => b.trackpoint(fileId, segmentId, index), undefined);
    }

    /**
     * A file as GPX (UTF-8 bytes), `undefined` if it does not exist. The options say which data of the
     * trackpoints to keep.
     */
    exportFile(
        fileId: string,
        options: ExportOptions = ALL_EXPORT_OPTIONS
    ): Promise<Uint8Array<ArrayBuffer> | undefined> {
        return this.read(
            (b) =>
                b.export_file(
                    fileId,
                    options.time,
                    options.hr,
                    options.cad,
                    options.atemp,
                    options.power,
                    options.osm,
                    options.asRoute
                ),
            undefined
        );
    }

    /** The data that some files have, which the options of `exportFile` can leave out. */
    async exportableData(fileIds: string[]): Promise<ExportOptions> {
        const bits = await this.read((b) => b.exportable_data(fileIds), 0);
        return {
            time: (bits & 1) !== 0,
            hr: (bits & 2) !== 0,
            cad: (bits & 4) !== 0,
            atemp: (bits & 8) !== 0,
            power: (bits & 16) !== 0,
            osm: (bits & 32) !== 0,
            // not a data
            asRoute: false,
        };
    }

    /**
     * For each trackpoint of the selection, in the order of the statistics, the highest tolerance
     * (m) of `reduce` that keeps it: infinite for the ends of the segments. Not requested with
     * the statistics: ask when they changed.
     */
    reductionDistances(): Promise<Float64Array> {
        return this.read((b) => b.reduction_distances(), new Float64Array());
    }

    // Coordinates, as flat [lng, lat, ...] arrays: copies.
    // Refetch them when the `rev` of the segment (or the `waypointsRev` of the file) changed.

    segmentCoordinates(segmentId: string): Promise<Float64Array> {
        return this.read((b) => b.segment_coordinates(segmentId), new Float64Array());
    }

    waypointCoordinates(fileId: string): Promise<Float64Array> {
        return this.read((b) => b.waypoint_coordinates(fileId), new Float64Array());
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

    // Plumbing

    /** Does `task` after the ones that were queued before it, whatever they do. */
    private enqueue<T>(task: () => Promise<T>): Promise<T> {
        const result = this._queue.then(task, task);
        this._queue = result.catch(() => {});
        return result;
    }

    /**
     * Makes a request to the engine, once the calls made before it are done. Resolves to
     * `fallback` when the engine is not loaded.
     */
    private read<T>(request: (backend: Backend) => Promise<T>, fallback: T): Promise<T> {
        return this.enqueue(async () => (this.backend ? request(this.backend) : fallback));
    }

    /**
     * Makes a call to the engine and applies its outcome to what is kept of the files. Resolves to
     * whether anything changed. When nothing did, `lastError` tells why.
     */
    private async run(action: (backend: Backend) => Promise<Outcome>): Promise<boolean> {
        await this.ready;
        return this.enqueue(async () => {
            const backend = this.backend!;
            try {
                const outcome = await action(backend);
                await this.sync(backend, outcome);
                this.report(outcome);
                return outcome.changed;
            } catch (error) {
                // what the engine refuses to do, like closing a folder whose files cannot be saved
                console.error('engine:', error);
                this._lastError.set(String(error));
                return false;
            }
        });
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
     * Updates what is kept of the engine with what a call changed. Everything is read first, then
     * the stores are updated together, in one go: the readers of the stores (the file list...)
     * rely on the order, the files and the selection being consistent when they are notified.
     */
    private async sync(backend: Backend, update: Outcome) {
        const [[canUndo, canRedo, canPaste], clipboard, selection, order] = await Promise.all([
            Promise.all([backend.can_undo(), backend.can_redo(), backend.can_paste()]),
            update.clipboardChanged ? backend.clipboard() : undefined,
            update.selectionChanged ? backend.selection() : undefined,
            update.orderChanged ? backend.file_order() : undefined,
        ]);

        const files = get(this._files);
        const [added, modified] = await Promise.all([
            Promise.all(
                update.added.map((id) => readFileState(backend, id, this._colors, this._visibility))
            ),
            Promise.all(
                update.modified.map((id) => {
                    const store = files.get(id);
                    return (
                        store &&
                        readFileState(backend, id, this._colors, this._visibility, get(store))
                    );
                })
            ),
        ]);

        this._canUndo.set(canUndo);
        this._canRedo.set(canRedo);
        this._canPaste.set(canPaste);
        if (update.clipboardChanged) {
            this._clipboard.set(clipboard);
        }
        if (selection) {
            this._selection.set(selection);
        }
        if (order) {
            this._order.set(order);
        }
        const addedStates: [string, FileState][] = [];
        update.added.forEach((id, i) => {
            const state = added[i];
            if (state) {
                addedStates.push([id, state]);
            }
        });
        if (addedStates.length > 0 || update.removed.length > 0) {
            this._files.update((files) => {
                const next = new Map(files);
                update.removed.forEach((id) => {
                    next.delete(id);
                    this._colors.release(id);
                });
                addedStates.forEach(([id, state]) => next.set(id, writable(state)));
                return next;
            });
        }
        update.modified.forEach((id, i) => {
            const state = modified[i];
            if (state) {
                files.get(id)?.set(state);
            }
        });

        if (update.added.length + update.modified.length + update.removed.length > 0) {
            await this.refreshWorkspace(backend);
        }

        // the statistics depend on the selection, on its order, and on the files
        if (
            update.selectionChanged ||
            update.orderChanged ||
            update.added.length + update.modified.length + update.removed.length > 0
        ) {
            await this._statistics.refresh(backend);
        }
    }
}

export const engine = new Engine();
