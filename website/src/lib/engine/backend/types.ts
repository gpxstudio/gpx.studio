import type {
    Clipboard,
    FileStructure,
    GlobalStatistics,
    MoveTarget,
    Outcome,
    RouteAttributes,
    Selection,
    SelectionPoint,
    StorageOpened,
    TrackpointDetails,
    WaypointDetails,
} from 'gpx-wasm';
import type { ExportOptions, MergeType, SelectMode, SplitType } from '../types';

/** What the desktop app knows of a file of the engine and the file system. */
export type FileStatus = {
    /** Where the file is on the disk, absent for a file that only is in the engine. */
    path?: string;
    /**
     * The folder where the file is written the first time it is saved, for a file that is not on
     * the disk and comes from (or was made in) the open folder.
     */
    folder?: string;
    /**
     * The file is not the one on the disk: it has edits, is not on the disk, or the file on the
     * disk is not the one that was read (it was replaced, or is gone).
     */
    dirty: boolean;
    /** The file on the disk was replaced by something else: saving overwrites it. */
    replaced: boolean;
    /** The file on the disk is gone. */
    missing: boolean;
    /** The file is open as a preview (a single click in the tree), which the next one replaces. */
    preview: boolean;
};

/** An entry of the tree of the open folder: a folder, or a GPX file. */
export type FolderEntry = {
    name: string;
    path: string;
    isDir: boolean;
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
     * Opens files of the file system by their path, like the ones of the tree of the folder. With
     * `preview`, a single file is open as a preview: the next preview replaces it, until it is
     * edited or opened for good. Otherwise they are open for good.
     */
    openPaths(paths: string[], preview?: boolean): Promise<Outcome>;
    /** The files are open for good: the preview among them is not a preview anymore. */
    keepFiles(fileIds: string[]): Promise<void>;
    /**
     * Opens the folder that the user picks, which is watched. Its files are not opened: they are
     * in its tree (`listFolder`). The folder that was open is closed with its files (see
     * `closeFiles` for `unsaved`).
     */
    openFolder(unsaved?: UnsavedChoice): Promise<Outcome>;
    /** Closes the open folder: it is not watched anymore, and its files are closed. */
    closeFolder(unsaved?: UnsavedChoice): Promise<Outcome>;
    /**
     * Closes files. What to do with the ones that have unsaved edits: `save` them first (the user
     * is asked where to put the ones that have no place), `discard` the edits, or keep them open
     * when it is not said.
     */
    closeFiles(fileIds: string[], unsaved?: UnsavedChoice): Promise<Outcome>;
    /**
     * Writes files to the disk, replacing what is there (the user is asked where to put the ones
     * that have no place: a file, or a folder for several of them). Resolves to false if the user
     * cancelled.
     */
    saveFiles(fileIds: string[]): Promise<boolean>;
    /** Writes a file where the user says, which is where it is from then on. False if cancelled. */
    saveFileAs(fileId: string): Promise<boolean>;
    /** Reads files again from the disk: their edits are lost (one undo step). */
    reloadFiles(fileIds: string[]): Promise<Outcome>;
    /**
     * Writes copies of files where the user says (a file, or a folder for several). The files stay
     * as they are. False if the user cancelled.
     */
    exportFiles(fileIds: string[], options: ExportOptions): Promise<boolean>;
    /** The folders and GPX files in a folder of the open folder (the open folder by default). */
    listFolder(path?: string): Promise<FolderEntry[]>;
    /** Opens a web page (or an email to write) in the app of the system for it. */
    openUrl(url: string): Promise<void>;
    /**
     * Makes a new file, written at once in `folder` (a folder of the open folder), and selects it.
     * With `route`, it starts with an empty route.
     */
    newFile(name: string, folder: string, route: boolean): Promise<Outcome>;
    /** Makes a folder in a folder of the open folder (numbered if the name is taken): its path. */
    createFolder(parent: string, name: string): Promise<string>;
    /**
     * Renames a file or a folder of the open folder. An open file is renamed like in its info (it
     * is selected), which can be undone.
     */
    renamePath(path: string, name: string): Promise<Outcome>;
    /** Moves files and folders of the open folder into a folder of it. */
    movePaths(paths: string[], folder: string): Promise<void>;
    /**
     * Moves files and folders of the open folder to the trash. The open files among them are
     * closed, unless they have edits.
     */
    deletePaths(paths: string[]): Promise<Outcome>;
    /** Shows a file or a folder in the file manager of the system. */
    revealPath(path: string): Promise<void>;
    /**
     * Tells when the engine changed without being asked, because the files on the disk did (the
     * outcome to apply), when the status of the files changed, when files were opened with the
     * app from the system (the outcome to apply, which selected them), and when something changed
     * in the open folder (the tree of its files is to be read again).
     */
    listen(
        onEngineChanged: (outcome: Outcome) => void,
        onWorkspaceChanged: (workspace: WorkspaceState) => void,
        onFilesOpened: (outcome: Outcome) => void,
        onFolderChanged: () => void
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
    select_routes(fileId: string, routeIds: string[], mode: SelectMode): Promise<Outcome>;
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
    new_file(
        name: string,
        lng: number | undefined,
        lat: number | undefined,
        ele: number | undefined,
        route: boolean
    ): Promise<Outcome>;
    load_files(files: { data: Uint8Array; name: string }[]): Promise<Outcome>;
    duplicate(): Promise<Outcome>;
    delete(wholeFiles: boolean): Promise<Outcome>;
    delete_all(): Promise<Outcome>;
    reorder(fileIds: string[], index: number): Promise<Outcome>;
    move_elements(what: Selection, to: MoveTarget): Promise<Outcome>;
    metadata(name: string, desc: string): Promise<Outcome>;
    style(color?: string, opacity?: number, width?: number): Promise<Outcome>;
    convert(): Promise<Outcome>;
    new_route(): Promise<Outcome>;
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
        osm: boolean
    ): Promise<Uint8Array<ArrayBuffer> | undefined>;
    exportable_data(fileIds: string[]): Promise<number>;
    reduction_distances(): Promise<Float64Array>;
    segment_coordinates(segmentId: string): Promise<Float64Array>;
    waypoint_coordinates(fileId: string): Promise<Float64Array>;

    // The statistics of the selection
    selection_statistics(): Promise<GlobalStatistics | undefined>;
    slice_statistics(start: number, end: number): Promise<GlobalStatistics | undefined>;
    total_distance(): Promise<Float64Array>;
    lng(): Promise<Float64Array>;
    lat(): Promise<Float64Array>;
    ele(): Promise<Float64Array>;
    speed(): Promise<Float64Array | undefined>;
    hr(): Promise<Float64Array | undefined>;
    cad(): Promise<Float64Array | undefined>;
    atemp(): Promise<Float64Array | undefined>;
    power(): Promise<Float64Array | undefined>;
    slope_segment_starts(): Promise<Uint32Array>;
    slope_segment_slopes(): Promise<Float64Array>;
    selection_point(index: number): Promise<SelectionPoint | undefined>;
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
