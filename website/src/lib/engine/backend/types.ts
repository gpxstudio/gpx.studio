import type {
    Clipboard,
    FileStructure,
    GlobalStatistics,
    MoveTarget,
    Outcome,
    RouteAttributes,
    Selection,
    StorageOpened,
    TrackpointDetails,
    WaypointDetails,
} from 'gpx-wasm';
import type { MergeType, SelectMode, SplitType } from '../types';

/** What the desktop app knows of a file of the engine and the file system. */
export type FileStatus = {
    /** Where the file is on the disk, absent for a file that only is in the engine. */
    path?: string;
    /** The file has edits that the file on the disk does not have (or is not on the disk). */
    dirty: boolean;
    /** The file on the disk was changed by something else while this one had edits. */
    conflict: boolean;
};

/** What to do with the files of a folder that have unsaved edits when it is closed. */
export type UnsavedChoice = 'save' | 'discard';

export type WorkspaceState = {
    /** The folder that is open, and watched. */
    folder?: string;
    files: Record<string, FileStatus>;
};

/**
 * What the desktop app adds: its files are linked to files of the file system. Only the backend of
 * the desktop app has it.
 */
export interface DesktopFiles {
    workspace(): Promise<WorkspaceState>;
    /** Opens the files that the user picks, which get selected. */
    openFiles(): Promise<Outcome>;
    /**
     * Opens the folder that the user picks: its files are opened, and it is watched. The folder
     * that was open is closed (see `closeFolder` for `unsaved`).
     */
    openFolder(unsaved?: UnsavedChoice): Promise<Outcome>;
    /**
     * Closes the open folder: it is not watched anymore, and its files are closed. What to do with
     * the ones that have unsaved edits: `save` them first, `discard` the edits, or keep them open
     * when it is not said. Rejects, and closes nothing, if they could not be saved.
     */
    closeFolder(unsaved?: UnsavedChoice): Promise<Outcome>;
    /**
     * Writes files to the disk, replacing what is there (the user is asked where to put the ones
     * that are not on the disk yet).
     */
    saveFiles(fileIds: string[]): Promise<void>;
    /**
     * Tells when the engine changed without being asked, because the files on the disk did (the
     * outcome to apply), when the status of the files changed, and when files were opened with the
     * app from the system (the outcome to apply, which selected them).
     */
    listen(
        onEngineChanged: (outcome: Outcome) => void,
        onWorkspaceChanged: (workspace: WorkspaceState) => void,
        onFilesOpened: (outcome: Outcome) => void
    ): Promise<void>;
}

/**
 * What the facade needs of the engine of the files, wherever it runs: the WASM module in the
 * browser (`wasm.ts`), or the Rust process of the desktop app, through its commands (`tauri.ts`).
 * Both give the same results: see `gpx-rs/src/api` for what each function does.
 *
 * Everything is asynchronous, because the desktop app is reached through messages. Ids are
 * hyphenated UUID strings, the arrays of numbers are typed arrays, and what the functions that
 * edit the files or change the selection return is an `Outcome`.
 */
export interface Backend {
    // Selection
    select(fileIds: string[], mode: SelectMode): Promise<Outcome>;
    select_all(): Promise<Outcome>;
    arrow_select(down: boolean, add: boolean): Promise<Outcome>;
    select_tracks(fileId: string, trackIds: string[], mode: SelectMode): Promise<Outcome>;
    select_segments(
        fileId: string,
        trackId: string,
        segmentIds: string[],
        mode: SelectMode
    ): Promise<Outcome>;
    select_waypoint_group(fileId: string, mode: SelectMode): Promise<Outcome>;
    select_waypoints(fileId: string, waypointIds: string[], mode: SelectMode): Promise<Outcome>;

    // History and clipboard
    undo(): Promise<Outcome>;
    redo(): Promise<Outcome>;
    copy(): Promise<Outcome>;
    cut(): Promise<Outcome>;
    paste(): Promise<Outcome>;

    // Files
    new_file(name: string, lng?: number, lat?: number, ele?: number): Promise<Outcome>;
    load_files(files: { data: Uint8Array; name: string }[]): Promise<Outcome>;
    duplicate(): Promise<Outcome>;
    delete(wholeFiles: boolean): Promise<Outcome>;
    delete_all(): Promise<Outcome>;
    reorder(fileIds: string[], index: number): Promise<Outcome>;
    move_elements(what: Selection, to: MoveTarget): Promise<Outcome>;
    metadata(name: string, desc: string): Promise<Outcome>;
    style(color?: string, opacity?: number, width?: number): Promise<Outcome>;
    new_track(): Promise<Outcome>;
    new_track_segment(): Promise<Outcome>;

    // Waypoints
    new_waypoint(
        lng: number,
        lat: number,
        ele: number,
        name: string,
        desc: string,
        icon: string,
        link: string
    ): Promise<Outcome>;
    update_waypoint(
        fileId: string,
        waypointId: string,
        lng: number,
        lat: number,
        ele: number,
        name: string,
        desc: string,
        icon: string,
        link: string
    ): Promise<Outcome>;
    move_waypoint(
        fileId: string,
        waypointId: string,
        lng: number,
        lat: number,
        ele: number
    ): Promise<Outcome>;
    delete_waypoint(fileId: string, waypointId: string): Promise<Outcome>;

    // Tools
    reverse(): Promise<Outcome>;
    extract(): Promise<Outcome>;
    round_trip(): Promise<Outcome>;
    elevation(ele: Float64Array): Promise<Outcome>;
    change_timestamps(startTime: number, speed: number, ratio: number): Promise<Outcome>;
    create_artificial_timestamps(startTime: number, totalTime: number): Promise<Outcome>;
    clean(
        west: number,
        south: number,
        east: number,
        north: number,
        inside: boolean,
        trackpoints: boolean,
        waypoints: boolean
    ): Promise<Outcome>;
    merge(type: MergeType, removeGaps: boolean): Promise<Outcome>;
    reduce(tolerance: number): Promise<Outcome>;
    crop(start: number, end: number): Promise<Outcome>;
    split(revision: number, at: number, type: SplitType): Promise<Outcome>;
    route(
        revision: number,
        start: number,
        end: number,
        lng: Float64Array,
        lat: Float64Array,
        ele: Float64Array,
        attributes: RouteAttributes,
        anchors: Uint32Array
    ): Promise<Outcome>;
    insert_anchor(revision: number, lng: number, lat: number): Promise<Outcome>;
    change_loop_start(revision: number, index: number): Promise<Outcome>;

    // The files and the selection
    can_undo(): Promise<boolean>;
    can_redo(): Promise<boolean>;
    can_paste(): Promise<boolean>;
    clipboard(): Promise<Clipboard | undefined>;
    selection(): Promise<Selection>;
    file_order(): Promise<string[]>;
    file_structure(fileId: string): Promise<FileStructure | undefined>;
    file_statistics(fileId: string): Promise<GlobalStatistics | undefined>;
    waypoint(fileId: string, waypointId: string): Promise<WaypointDetails | undefined>;
    trackpoint(
        fileId: string,
        segmentId: string,
        index: number
    ): Promise<TrackpointDetails | undefined>;
    /** A file as GPX (UTF-8 bytes), `undefined` if it does not exist. */
    export_file(
        fileId: string,
        time: boolean,
        hr: boolean,
        cad: boolean,
        atemp: boolean,
        power: boolean,
        osm: boolean,
        asRoute: boolean
    ): Promise<Uint8Array<ArrayBuffer> | undefined>;
    exportable_data(fileIds: string[]): Promise<number>;
    reduction_distances(): Promise<Float64Array>;
    segment_coordinates(segmentId: string): Promise<Float64Array>;
    waypoint_coordinates(fileId: string): Promise<Float64Array>;

    // The statistics of the selection
    selection_statistics(): Promise<GlobalStatistics | undefined>;
    slice_statistics(start: number, end: number): Promise<GlobalStatistics | undefined>;
    total_distance(): Promise<Float64Array>;
    slope(): Promise<Float64Array>;
    lng(): Promise<Float64Array>;
    lat(): Promise<Float64Array>;
    ele(): Promise<Float64Array>;
    timestamps(): Promise<BigInt64Array | undefined>;
    speed(): Promise<Float64Array | undefined>;
    hr(): Promise<Float64Array | undefined>;
    cad(): Promise<Float64Array | undefined>;
    atemp(): Promise<Float64Array | undefined>;
    power(): Promise<Float64Array | undefined>;
    slope_segment_slope(): Promise<Float64Array>;
    slope_segment_distance(): Promise<Float64Array>;
    surface_starts(): Promise<Uint32Array>;
    surface_values(): Promise<Uint8Array>;
    surfaces(): Promise<string[]>;
    highway_starts(): Promise<Uint32Array>;
    highway_values(): Promise<Uint8Array>;
    highways(): Promise<string[]>;
    sac_scale_starts(): Promise<Uint32Array>;
    sac_scale_values(): Promise<Uint8Array>;
    sac_scales(): Promise<string[]>;
    mtb_scale_starts(): Promise<Uint32Array>;
    mtb_scale_values(): Promise<Uint8Array>;
    mtb_scales(): Promise<string[]>;
    anchor_indices(): Promise<Uint32Array>;
    anchor_zooms(): Promise<Uint8Array>;
    segment_starts(): Promise<Uint32Array>;
    segment_ids(): Promise<string[]>;
    routing_revision(): Promise<number>;

    /** Present when the files are linked to the file system (the desktop app). */
    readonly desktop?: DesktopFiles;

    // Storage
    /**
     * Whether the files that the previous versions of the app kept in the browser can be imported
     * (they are in the IndexedDB of the browser).
     */
    readonly importsLegacyData: boolean;
    /**
     * Opens the storage: the files that it holds are put in the engine, and the changes of the
     * files are kept from then on. `onSaved` is called after the files were written, `onBehind`
     * when a write was refused because another window wrote since (call `sync_storage` then), and
     * `onNewer` when what is stored comes from a newer version of the app.
     */
    open_storage(
        name: string,
        onSaved: () => void,
        onBehind: () => void,
        onNewer: () => void
    ): Promise<StorageOpened>;
    /** Resolves when what was changed has been written to the storage. */
    flush_storage(): Promise<void>;
    /** Reads the files again if another window wrote them since, and tells what changed. */
    sync_storage(): Promise<Outcome>;
    set_setting(key: string, json: string): Promise<void>;
    delete_setting(key: string): Promise<void>;
}
