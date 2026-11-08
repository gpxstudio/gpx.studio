import type { Backend } from './types';
import type { MergeType, SelectMode, SplitType } from '../types';

type Wasm = typeof import('gpx-wasm');

/** A call of the module, which is synchronous, as an asynchronous one. */
const lift =
    <A extends unknown[], R>(f: (...args: A) => R) =>
    async (...args: A): Promise<R> =>
        f(...args);

/** Hyphenated UUID strings to the concatenated 16-byte form the module takes. */
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

/** The engine in the page, as the WebAssembly module of `wasm`. */
export async function createWasmBackend(): Promise<Backend> {
    const w: Wasm = await import('gpx-wasm');
    w.start();

    const mode = (m: SelectMode) =>
        ({ replace: w.SelectMode.Replace, add: w.SelectMode.Add, toggle: w.SelectMode.Toggle })[m];
    const splitType = (t: SplitType) =>
        ({
            files: w.SplitType.Files,
            routes: w.SplitType.Routes,
            tracks: w.SplitType.Tracks,
            segments: w.SplitType.Segments,
        })[t];
    const mergeType = (t: MergeType) => (t === 'connect' ? w.MergeType.Connect : w.MergeType.Group);

    return {
        select: lift((ids, m) => w.select(idsToBytes(ids), mode(m))),
        select_all: lift(w.select_all),
        arrow_select: lift(w.arrow_select),
        select_routes: lift((file, ids, m) => w.select_routes(file, idsToBytes(ids), mode(m))),
        select_tracks: lift((file, ids, m) => w.select_tracks(file, idsToBytes(ids), mode(m))),
        select_segments: lift((file, track, ids, m) =>
            w.select_segments(file, track, idsToBytes(ids), mode(m))
        ),
        select_waypoint_group: lift((file, m) => w.select_waypoint_group(file, mode(m))),
        select_waypoints: lift((file, ids, m) =>
            w.select_waypoints(file, idsToBytes(ids), mode(m))
        ),

        undo: lift(w.undo),
        redo: lift(w.redo),
        copy: lift(w.copy),
        cut: lift(w.cut),
        paste: lift(w.paste),

        new_file: lift(w.new_file),
        load_files: lift((files) => {
            const lengths = Uint32Array.from(files.map((file) => file.data.length));
            const data = new Uint8Array(lengths.reduce((sum, length) => sum + length, 0));
            let offset = 0;
            for (const file of files) {
                data.set(file.data, offset);
                offset += file.data.length;
            }
            return w.load_files(
                data,
                lengths,
                files.map((file) => file.name)
            );
        }),
        duplicate: lift(w.duplicate),
        delete: lift(w._delete),
        delete_all: lift(w.delete_all),
        reorder: lift((ids, index) => w.reorder(idsToBytes(ids), index)),
        move_elements: lift(w.move_elements),
        metadata: lift(w.metadata),
        style: lift(w.style),
        convert: lift(w.convert),
        new_route: lift(w.new_route),
        new_track: lift(w.new_track),
        new_track_segment: lift(w.new_track_segment),

        new_waypoint: lift(w.new_waypoint),
        update_waypoint: lift(w.update_waypoint),
        move_waypoint: lift(w.move_waypoint),
        delete_waypoint: lift(w.delete_waypoint),

        reverse: lift(w.reverse),
        extract: lift(w.extract),
        round_trip: lift(w.round_trip),
        elevation: lift(w.elevation),
        change_timestamps: lift(w.changeTimestamps),
        create_artificial_timestamps: lift(w.createArtificialTimestamps),
        clean: lift((west, south, east, north, inside, trackpoints, waypoints) =>
            w.clean(
                west,
                south,
                east,
                north,
                inside ? w.CleanType.Inside : w.CleanType.Outside,
                trackpoints,
                waypoints
            )
        ),
        merge: lift((type, removeGaps) => w.merge(mergeType(type), removeGaps)),
        reduce: lift(w.reduce),
        crop: lift(w.crop),
        split: lift((revision, at, type) => w.split(revision, at, splitType(type))),
        route: lift(w.route),
        insert_anchor: lift(w.insert_anchor),
        change_loop_start: lift(w.change_loop_start),

        can_undo: lift(w.can_undo),
        can_redo: lift(w.can_redo),
        can_paste: lift(w.can_paste),
        clipboard: lift(w.clipboard),
        selection: lift(w.selection),
        file_order: lift(w.file_order),
        file_structure: lift(w.file_structure),
        file_statistics: lift(w.file_statistics),
        waypoint: lift(w.waypoint),
        trackpoint: lift(w.trackpoint),
        // a copy out of the memory of the engine, so a plain ArrayBuffer
        export_file: lift(
            (...args: Parameters<Backend['export_file']>) =>
                w.export_file(...args) as Uint8Array<ArrayBuffer> | undefined
        ),
        exportable_data: lift((ids) => w.exportable_data(idsToBytes(ids))),
        reduction_distances: lift(w.reduction_distances),
        segment_coordinates: lift(w.segment_coordinates),
        waypoint_coordinates: lift(w.waypoint_coordinates),

        selection_statistics: lift(w.selection_statistics),
        slice_statistics: lift(w.slice_statistics),
        total_distance: lift(w.total_distance),
        lng: lift(w.lng),
        lat: lift(w.lat),
        ele: lift(w.ele),
        speed: lift(w.speed),
        hr: lift(w.hr),
        cad: lift(w.cad),
        atemp: lift(w.atemp),
        power: lift(w.power),
        slope_segment_starts: lift(w.slope_segment_starts),
        slope_segment_slopes: lift(w.slope_segment_slopes),
        selection_point: lift(w.selection_point),
        surface_starts: lift(w.surface_starts),
        surface_values: lift(w.surface_values),
        surfaces: lift(w.surfaces),
        highway_starts: lift(w.highway_starts),
        highway_values: lift(w.highway_values),
        highways: lift(w.highways),
        sac_scale_starts: lift(w.sac_scale_starts),
        sac_scale_values: lift(w.sac_scale_values),
        sac_scales: lift(w.sac_scales),
        mtb_scale_starts: lift(w.mtb_scale_starts),
        mtb_scale_values: lift(w.mtb_scale_values),
        mtb_scales: lift(w.mtb_scales),
        anchor_indices: lift(w.anchor_indices),
        anchor_zooms: lift(w.anchor_zooms),
        segment_starts: lift(w.segment_starts),
        segment_ids: lift(w.segment_ids),
        routing_revision: lift(w.routing_revision),

        importsLegacyData: true,
        open_storage: (name, onSaved, onBehind, onNewer) =>
            w.open_storage(name, onSaved, onBehind, onNewer),
        flush_storage: () => w.flush_storage(),
        sync_storage: () => w.sync_storage(),
        set_setting: lift(w.set_setting),
        delete_setting: lift(w.delete_setting),
    };
}
