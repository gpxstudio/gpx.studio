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
