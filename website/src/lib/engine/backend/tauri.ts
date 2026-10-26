import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Outcome, RouteAttributes, StorageOpened } from 'gpx-wasm';
import type { Backend, FolderEntry, WorkspaceState } from './types';

/** An array that a command returns as its bytes. */
const array = async <T>(
    command: string,
    type: { new (buffer: ArrayBuffer): T },
    args?: Record<string, unknown>
) => new type(await invoke<ArrayBuffer>(command, args));

/** Like `array`, for the arrays that can be absent: the first byte tells whether they are there. */
const optionalArray = async <T>(
    command: string,
    type: { new (buffer: ArrayBuffer): T },
    args?: Record<string, unknown>
) => {
    const bytes = await invoke<ArrayBuffer>(command, args);
    return new Uint8Array(bytes)[0] === 1 ? new type(bytes.slice(1)) : undefined;
};

const category = (c?: RouteAttributes['surface']) =>
    c && { starts: Array.from(c.starts), values: Array.from(c.values), names: c.names };

/**
 * The engine in the Rust process of the desktop app, reached through its commands (see
 * `tauri/src/commands`). Typed arrays are returned as bytes, little-endian.
 */
export async function createTauriBackend(): Promise<Backend> {
    const f64 = (command: string, args?: Record<string, unknown>) =>
        array(command, Float64Array, args);
    const u32 = (command: string) => array(command, Uint32Array);
    const u8 = (command: string) => array(command, Uint8Array);
    const f64Optional = (command: string) => optionalArray(command, Float64Array);

    return {
        select: (fileIds, mode) => invoke('select', { fileIds, mode }),
        select_all: () => invoke('select_all'),
        arrow_select: (down, add) => invoke('arrow_select', { down, add }),
        select_routes: (fileId, routeIds, mode) =>
            invoke('select_routes', { fileId, routeIds, mode }),
        select_tracks: (fileId, trackIds, mode) =>
            invoke('select_tracks', { fileId, trackIds, mode }),
        select_segments: (fileId, trackId, segmentIds, mode) =>
            invoke('select_segments', { fileId, trackId, segmentIds, mode }),
        select_waypoint_group: (fileId, mode) => invoke('select_waypoint_group', { fileId, mode }),
        select_waypoints: (fileId, waypointIds, mode) =>
            invoke('select_waypoints', { fileId, waypointIds, mode }),

        undo: () => invoke('undo'),
        redo: () => invoke('redo'),
        copy: () => invoke('copy'),
        cut: () => invoke('cut'),
        paste: () => invoke('paste'),

        new_file: (name, lng, lat, ele) => invoke('new_file', { name, lng, lat, ele }),
        load_files: (files) => {
            const data = new Uint8Array(files.reduce((sum, file) => sum + file.data.length, 0));
            let offset = 0;
            for (const file of files) {
                data.set(file.data, offset);
                offset += file.data.length;
            }
            // headers are ASCII
            const header = (value: unknown) => encodeURIComponent(JSON.stringify(value));
            return invoke('load_files', data, {
                headers: {
                    lengths: header(files.map((file) => file.data.length)),
                    names: header(files.map((file) => file.name)),
                },
            });
        },
        duplicate: () => invoke('duplicate'),
        delete: (wholeFiles) => invoke('delete', { wholeFiles }),
        delete_all: () => invoke('delete_all'),
        reorder: (fileIds, index) => invoke('reorder', { fileIds, index }),
        // an infinite index is the end of the list, which JSON cannot tell
        move_elements: (what, to) =>
            invoke('move_elements', {
                what,
                to: { ...to, index: Math.min(to.index, Number.MAX_SAFE_INTEGER) },
            }),
        metadata: (name, desc) => invoke('metadata', { name, desc }),
        style: (color, opacity, width) => invoke('style', { color, opacity, width }),
        new_route: () => invoke('new_route'),
        new_track: () => invoke('new_track'),
        new_track_segment: () => invoke('new_track_segment'),

        new_waypoint: (lng, lat, ele, name, desc, icon, link) =>
            invoke('new_waypoint', { lng, lat, ele, name, desc, icon, link }),
        update_waypoint: (fileId, waypointId, lng, lat, ele, name, desc, icon, link) =>
            invoke('update_waypoint', {
                fileId,
                waypointId,
                lng,
                lat,
                ele,
                name,
                desc,
                icon,
                link,
            }),
        move_waypoint: (fileId, waypointId, lng, lat, ele) =>
            invoke('move_waypoint', { fileId, waypointId, lng, lat, ele }),
        delete_waypoint: (fileId, waypointId) => invoke('delete_waypoint', { fileId, waypointId }),

        reverse: () => invoke('reverse'),
        extract: () => invoke('extract'),
        round_trip: () => invoke('round_trip'),
        elevation: (ele) => invoke('elevation', { ele: Array.from(ele) }),
        change_timestamps: (startTime, speed, ratio) =>
            invoke('change_timestamps', { startTime, speed, ratio }),
        create_artificial_timestamps: (startTime, totalTime) =>
            invoke('create_artificial_timestamps', { startTime, totalTime }),
        clean: (west, south, east, north, inside, trkpt, wpt) =>
            invoke('clean', {
                west,
                south,
                east,
                north,
                cleanType: inside ? 'inside' : 'outside',
                trkpt,
                wpt,
            }),
        merge: (mergeType, removeGaps) => invoke('merge', { mergeType, removeGaps }),
        reduce: (tolerance) => invoke('reduce', { tolerance }),
        crop: (start, end) => invoke('crop', { start, end }),
        split: (revision, at, splitType) => invoke('split', { revision, at, splitType }),
        route: (revision, start, end, lng, lat, ele, attributes, anchors) =>
            invoke('route', {
                revision,
                start,
                end,
                lng: Array.from(lng),
                lat: Array.from(lat),
                ele: Array.from(ele),
                attributes: {
                    surface: category(attributes.surface),
                    highway: category(attributes.highway),
                    sacScale: category(attributes.sacScale),
                    mtbScale: category(attributes.mtbScale),
                },
                anchors: Array.from(anchors),
            }),
        insert_anchor: (revision, lng, lat) => invoke('insert_anchor', { revision, lng, lat }),
        change_loop_start: (revision, index) => invoke('change_loop_start', { revision, index }),

        can_undo: () => invoke('can_undo'),
        can_redo: () => invoke('can_redo'),
        can_paste: () => invoke('can_paste'),
        clipboard: async () => (await invoke('clipboard')) ?? undefined,
        selection: () => invoke('selection'),
        file_order: () => invoke('file_order'),
        file_structure: async (fileId) => (await invoke('file_structure', { fileId })) ?? undefined,
        file_statistics: async (fileId) =>
            (await invoke('file_statistics', { fileId })) ?? undefined,
        waypoint: async (fileId, waypointId) =>
            (await invoke('waypoint', { fileId, waypointId })) ?? undefined,
        trackpoint: async (fileId, segmentId, index) =>
            (await invoke('trackpoint', { fileId, segmentId, index })) ?? undefined,
        export_file: async (fileId, time, hr, cad, atemp, power, osm) => {
            const file = await optionalArray('export_file', Uint8Array, {
                fileId,
                time,
                hr,
                cad,
                atemp,
                power,
                osm,
            });
            return file as Uint8Array<ArrayBuffer> | undefined;
        },
        exportable_data: (fileIds) => invoke('exportable_data', { fileIds }),
        reduction_distances: () => f64('reduction_distances'),
        segment_coordinates: (segmentId) => f64('segment_coordinates', { segmentId }),
        waypoint_coordinates: (fileId) => f64('waypoint_coordinates', { fileId }),

        selection_statistics: () => invoke('selection_statistics'),
        slice_statistics: async (start, end) =>
            (await invoke('slice_statistics', { start, end })) ?? undefined,
        total_distance: () => f64('total_distance'),
        lng: () => f64('lng'),
        lat: () => f64('lat'),
        ele: () => f64('ele'),
        speed: () => f64Optional('speed'),
        hr: () => f64Optional('hr'),
        cad: () => f64Optional('cad'),
        atemp: () => f64Optional('atemp'),
        power: () => f64Optional('power'),
        slope_segment_starts: () => u32('slope_segment_starts'),
        slope_segment_slopes: () => f64('slope_segment_slopes'),
        selection_point: async (index) => (await invoke('selection_point', { index })) ?? undefined,
        surface_starts: () => u32('surface_starts'),
        surface_values: () => u8('surface_values'),
        surfaces: () => invoke('surfaces'),
        highway_starts: () => u32('highway_starts'),
        highway_values: () => u8('highway_values'),
        highways: () => invoke('highways'),
        sac_scale_starts: () => u32('sac_scale_starts'),
        sac_scale_values: () => u8('sac_scale_values'),
        sac_scales: () => invoke('sac_scales'),
        mtb_scale_starts: () => u32('mtb_scale_starts'),
        mtb_scale_values: () => u8('mtb_scale_values'),
        mtb_scales: () => invoke('mtb_scales'),
        anchor_indices: () => u32('anchor_indices'),
        anchor_zooms: () => u8('anchor_zooms'),
        segment_starts: () => u32('segment_starts'),
        segment_ids: () => invoke('segment_ids'),
        routing_revision: () => invoke('routing_revision'),

        desktop: {
            workspace: () => invoke<WorkspaceState>('workspace_state'),
            openFiles: () => invoke<Outcome>('open_files'),
            openPaths: (paths, preview) => invoke<Outcome>('open_paths', { paths, preview }),
            keepFiles: (fileIds) => invoke('keep_files', { fileIds }),
            openFolder: (unsaved) => invoke<Outcome>('open_folder', { unsaved }),
            closeFolder: (unsaved) => invoke<Outcome>('close_folder', { unsaved }),
            closeFiles: (fileIds, unsaved) => invoke<Outcome>('close_files', { fileIds, unsaved }),
            saveFiles: (fileIds) => invoke<boolean>('save_files', { fileIds }),
            saveFileAs: (fileId) => invoke<boolean>('save_file_as', { fileId }),
            reloadFiles: (fileIds) => invoke<Outcome>('reload_files', { fileIds }),
            exportFiles: (fileIds, options) =>
                invoke<boolean>('export_files', { fileIds, options }),
            listFolder: (path) => invoke<FolderEntry[]>('list_folder', { path }),
            openUrl: (url) => invoke('open_url', { url }),
            newFile: (name, folder) => invoke<Outcome>('new_file', { name, folder }),
            createFolder: (parent, name) => invoke<string>('create_folder', { parent, name }),
            renamePath: (path, name) => invoke<Outcome>('rename_path', { path, name }),
            movePaths: (paths, folder) => invoke('move_paths', { paths, folder }),
            deletePaths: (paths) => invoke<Outcome>('delete_paths', { paths }),
            revealPath: (path) => invoke('reveal_path', { path }),
            listen: async (onEngineChanged, onWorkspaceChanged, onFilesOpened, onFolderChanged) => {
                await listen<Outcome>('files-opened', (event) => onFilesOpened(event.payload));
                await listen<Outcome>('engine-changed', (event) => onEngineChanged(event.payload));
                await listen<WorkspaceState>('workspace-changed', (event) =>
                    onWorkspaceChanged(event.payload)
                );
                await listen<string[]>('folder-changed', () => onFolderChanged());
            },
        },

        importsLegacyData: false,
        open_storage: () => invoke<StorageOpened>('open_storage'),
        flush_storage: () => invoke('flush_storage'),
        sync_storage: () => invoke('sync_storage'),
        set_setting: (key, value) => invoke('set_setting', { key, value }),
        delete_setting: (key) => invoke('delete_setting', { key }),
    };
}
