//! Frontier between the SvelteKit frontend and the engine.
//!
//! Conventions, chosen to keep calls cheap:
//! - Coordinates and elevations cross as `Float64Array` (`&[f64]`): one memcpy into linear
//!   memory, no per-point calls. `lng`/`lat`/`ele` arrays must have the same length.
//! - File bytes cross as `Uint8Array` (`&[u8]`), strings as `&str`.
//! - File ids cross as one flat `Uint8Array` of concatenated 16-byte UUIDs (no `Array<string>`).
//! - Rectangles cross as four numbers instead of an object.
//! - Ids read from the file tree are hyphenated UUID strings; the functions reading buffers take
//!   them as such.
//! - Every function returns `false` when its arguments are invalid or the command did nothing.
use std::cell::RefCell;

use wasm_bindgen::prelude::*;

use gpx_engine::{self as engine, Action, Command, Engine, FileId, LngLat, LngLatBounds};
use js_sys::{Array, BigInt64Array, Float64Array, Object, Reflect, Uint8Array, Uint32Array};

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum MergeType {
    Connect,
    Group,
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum CleanType {
    Inside,
    Outside,
}

/// How a selection combines with the current one: `Replace` it, `Add` to it, or `Toggle` the
/// elements (the ones already selected are removed).
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum SelectMode {
    Replace,
    Add,
    Toggle,
}

impl From<SelectMode> for engine::SelectMode {
    fn from(m: SelectMode) -> Self {
        match m {
            SelectMode::Replace => Self::Replace,
            SelectMode::Add => Self::Add,
            SelectMode::Toggle => Self::Toggle,
        }
    }
}

impl From<MergeType> for engine::MergeType {
    fn from(t: MergeType) -> Self {
        match t {
            MergeType::Connect => Self::Connect,
            MergeType::Group => Self::Group,
        }
    }
}

impl From<CleanType> for engine::CleanType {
    fn from(t: CleanType) -> Self {
        match t {
            CleanType::Inside => Self::Inside,
            CleanType::Outside => Self::Outside,
        }
    }
}

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
}

fn execute(action: Action) -> bool {
    ENGINE.with(|engine| {
        engine
            .borrow_mut()
            .as_mut()
            .is_some_and(|engine| engine.execute(action))
    })
}

fn edit(command: Command) -> bool {
    execute(Action::Edit(command))
}

/// Decodes concatenated 16-byte UUIDs.
fn uuid_list(bytes: &[u8]) -> Option<Vec<uuid::Uuid>> {
    let (chunks, rest) = bytes.as_chunks::<16>();
    rest.is_empty()
        .then(|| chunks.iter().map(|c| uuid::Uuid::from_bytes(*c)).collect())
}

fn file_ids(bytes: &[u8]) -> Option<Vec<FileId>> {
    uuid_list(bytes).map(|ids| ids.into_iter().map(FileId).collect())
}

fn parse_file_id(id: &str) -> Option<FileId> {
    uuid::Uuid::parse_str(id).ok().map(FileId)
}

fn same_len(a: &[f64], b: &[f64], c: &[f64]) -> bool {
    a.len() == b.len() && b.len() == c.len()
}

#[wasm_bindgen]
pub fn start() {
    console_error_panic_hook::set_once();
    ENGINE.with(|engine| {
        *engine.borrow_mut() = Some(Engine::default());
    });
}

// Statistics buffers
//
// These are views into wasm memory: they are invalidated by the next command (and any
// allocation), so read or copy them right away.

fn with_stats<T>(f: impl FnOnce(&engine::StatisticsBuffer) -> T) -> Option<T> {
    ENGINE.with(|engine| engine.borrow().as_ref().map(|e| f(e.statistics())))
}

macro_rules! stats_getter {
    ($name:ident, $array:ident) => {
        #[wasm_bindgen]
        pub fn $name() -> $array {
            with_stats(|s| unsafe { $array::view(&s.$name) })
                .unwrap_or_else(|| $array::new_with_length(0))
        }
    };
}

stats_getter!(total_distance, Float64Array);
stats_getter!(moving_distance, Float64Array);
// Durations since the start of the selection, in milliseconds.
stats_getter!(total_time, BigInt64Array);
stats_getter!(moving_time, BigInt64Array);
stats_getter!(speed, Float64Array);
stats_getter!(elevation_gain, Float64Array);
stats_getter!(elevation_loss, Float64Array);
stats_getter!(slope, Float64Array);
stats_getter!(slope_segment_slope, Float64Array);
stats_getter!(slope_segment_distance, Float64Array);
stats_getter!(lng, Float64Array);
stats_getter!(lat, Float64Array);
stats_getter!(ele, Float64Array);

// The optional values are `undefined` when no trackpoint of the selection has one, else they have
// an entry per trackpoint, the missing ones being NaN (`NO_TIME` for the timestamps).
macro_rules! optional_stats_getter {
    ($name:ident, $field:ident, $array:ident) => {
        #[wasm_bindgen]
        pub fn $name() -> Option<$array> {
            with_stats(|s| {
                s.$field
                    .as_ref()
                    .map(|values| unsafe { $array::view(values) })
            })
            .flatten()
        }
    };
}

// Timestamps in milliseconds since the epoch (`NO_TIME`, the smallest i64, when missing).
optional_stats_getter!(timestamps, time, BigInt64Array);

/// Value of the timestamps of the trackpoints that have none.
#[wasm_bindgen]
pub fn no_time() -> i64 {
    engine::NO_TIME
}

optional_stats_getter!(hr, hr, Float64Array);
optional_stats_getter!(cad, cad, Float64Array);
optional_stats_getter!(atemp, atemp, Float64Array);
optional_stats_getter!(power, power, Float64Array);

// Surface, highway, SAC scale and MTB scale of the trackpoints, as intervals of trackpoints that
// have the same value: `<name>_starts` holds the index of the first trackpoint of each interval,
// and `<name>_values` its value (0 when unknown, else 1 + the index in `surfaces()`,
// `highways()`, `sac_scales()` or `mtb_scales()`). A value that is unknown for every trackpoint is
// a single interval.
macro_rules! intervals_getters {
    ($starts:ident, $values:ident, $field:ident) => {
        #[wasm_bindgen]
        pub fn $starts() -> Uint32Array {
            with_stats(|s| unsafe { Uint32Array::view(&s.$field.starts) })
                .unwrap_or_else(|| Uint32Array::new_with_length(0))
        }

        #[wasm_bindgen]
        pub fn $values() -> Uint8Array {
            with_stats(|s| unsafe { Uint8Array::view(&s.$field.values) })
                .unwrap_or_else(|| Uint8Array::new_with_length(0))
        }
    };
}

intervals_getters!(surface_starts, surface_values, surface);
intervals_getters!(highway_starts, highway_values, highway);
intervals_getters!(sac_scale_starts, sac_scale_values, sac_scale);
intervals_getters!(mtb_scale_starts, mtb_scale_values, mtb_scale);

/// The names of the surfaces, in the order of their codes (see `surface_values`). The list only grows:
/// a name keeps its index.
#[wasm_bindgen]
pub fn surfaces() -> StringList {
    with_engine(|e| array(e.categories().surface.names(), |name| name.as_str().into()))
        .unwrap_or_default()
        .unchecked_into()
}

/// The names of the highways, in the order of their codes (see `highway_values`).
#[wasm_bindgen]
pub fn highways() -> StringList {
    with_engine(|e| array(e.categories().highway.names(), |name| name.as_str().into()))
        .unwrap_or_default()
        .unchecked_into()
}

/// The names of the SAC scales, in the order of their codes (see `sac_scale_values`).
#[wasm_bindgen]
pub fn sac_scales() -> StringList {
    with_engine(|e| {
        array(e.categories().sac_scale.names(), |name| {
            name.as_str().into()
        })
    })
    .unwrap_or_default()
    .unchecked_into()
}

/// The names of the MTB scales, in the order of their codes (see `mtb_scale_values`).
#[wasm_bindgen]
pub fn mtb_scales() -> StringList {
    with_engine(|e| {
        array(e.categories().mtb_scale.names(), |name| {
            name.as_str().into()
        })
    })
    .unwrap_or_default()
    .unchecked_into()
}

// File commands

#[wasm_bindgen]
pub fn new_file(name: &str) -> bool {
    edit(Command::New(engine::New { name }))
}

/// Loads files as a single command (one undo step). The files are in `data`, one after the
/// other, `lengths` being the number of bytes of each one. `names`: the name of each file when
/// its data has none (the name on disk, without extension). The files that cannot be read are
/// skipped, the first one that was read is selected.
#[wasm_bindgen]
pub fn load_files(data: &[u8], lengths: &[u32], names: Vec<String>) -> bool {
    if lengths.len() != names.len() {
        return false;
    }
    let mut files = Vec::with_capacity(names.len());
    let mut offset = 0;
    for (length, name) in lengths.iter().zip(&names) {
        let end = offset + *length as usize;
        let Some(data) = data.get(offset..end) else {
            return false;
        };
        files.push(engine::Load { data, name });
        offset = end;
    }
    edit(Command::LoadFiles(engine::LoadFiles { files }))
}

#[wasm_bindgen]
pub fn duplicate() -> bool {
    edit(Command::Duplicate(engine::Duplicate))
}

/// Deletes the selected elements. With `whole_files`, the files holding the selected elements are
/// deleted instead, even if only a track or a waypoint is selected.
#[wasm_bindgen]
pub fn delete(whole_files: bool) -> bool {
    edit(Command::Delete(engine::Delete { whole_files }))
}

#[wasm_bindgen]
pub fn delete_all() -> bool {
    edit(Command::DeleteAll(engine::DeleteAll))
}

/// Moves the files to `index` among the other files, in the given order (not undoable).
/// `file_ids_bytes`: concatenated 16-byte UUIDs.
#[wasm_bindgen]
pub fn reorder(file_ids_bytes: &[u8], index: usize) -> bool {
    file_ids(file_ids_bytes).is_some_and(|file_ids| execute(Action::Reorder { file_ids, index }))
}

// Edit commands

#[wasm_bindgen]
pub fn metadata(name: &str, desc: &str) -> bool {
    edit(Command::Metadata(engine::Metadata { name, desc }))
}

#[wasm_bindgen]
pub fn style(color: Option<String>, opacity: Option<f64>, width: Option<f64>) -> bool {
    edit(Command::Style(engine::Style {
        color: color.as_deref(),
        opacity,
        width,
    }))
}

#[wasm_bindgen]
pub fn new_track() -> bool {
    edit(Command::NewTrack(engine::NewTrack))
}

#[wasm_bindgen]
pub fn new_track_segment() -> bool {
    edit(Command::NewTrackSegment(engine::NewTrackSegment))
}

// Tools

#[wasm_bindgen]
pub fn reverse() -> bool {
    edit(Command::Reverse(engine::Reverse))
}

#[wasm_bindgen]
pub fn splice_trackpoints(start: u32, end: u32, lng: &[f64], lat: &[f64], ele: &[f64]) -> bool {
    start <= end
        && same_len(lng, lat, ele)
        && edit(Command::SpliceTrackpoints(engine::SpliceTrackpoints {
            start,
            end,
            lng,
            lat,
            ele,
        }))
}

#[wasm_bindgen]
pub fn new_waypoint(
    lng: f64,
    lat: f64,
    ele: f64,
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) -> bool {
    edit(Command::NewWaypoint(engine::NewWaypoint {
        lng,
        lat,
        ele,
        name,
        desc,
        icon,
        link,
    }))
}

/// Moves a waypoint of a file, whatever is selected.
#[wasm_bindgen]
pub fn move_waypoint(file_id: &str, waypoint_id: &str, lng: f64, lat: f64, ele: f64) -> bool {
    match (parse_file_id(file_id), parse_waypoint_id(waypoint_id)) {
        (Some(file_id), Some(waypoint_id)) => edit(Command::MoveWaypoint(engine::MoveWaypoint {
            file_id,
            waypoint_id,
            lng,
            lat,
            ele,
        })),
        _ => false,
    }
}

/// Deletes a waypoint of a file, whatever is selected.
#[wasm_bindgen]
pub fn delete_waypoint(file_id: &str, waypoint_id: &str) -> bool {
    match (parse_file_id(file_id), parse_waypoint_id(waypoint_id)) {
        (Some(file_id), Some(waypoint_id)) => {
            edit(Command::DeleteWaypoint(engine::DeleteWaypoint {
                file_id,
                waypoint_id,
            }))
        }
        _ => false,
    }
}

fn parse_waypoint_id(id: &str) -> Option<engine::WaypointId> {
    uuid::Uuid::parse_str(id).ok().map(engine::WaypointId)
}

/// Changes a waypoint of a file, whatever is selected: its name, description, icon, link, position
/// and elevation. The strings that are empty remove the field.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn update_waypoint(
    file_id: &str,
    waypoint_id: &str,
    lng: f64,
    lat: f64,
    ele: f64,
    name: &str,
    desc: &str,
    icon: &str,
    link: &str,
) -> bool {
    match (parse_file_id(file_id), parse_waypoint_id(waypoint_id)) {
        (Some(file_id), Some(waypoint_id)) => edit(Command::EditWaypoint(engine::EditWaypoint {
            file_id,
            waypoint_id,
            lng,
            lat,
            ele,
            name,
            desc,
            icon,
            link,
        })),
        _ => false,
    }
}

#[wasm_bindgen]
pub fn crop(start: u32, end: u32) -> bool {
    start <= end && edit(Command::Crop(engine::Crop { start, end }))
}

#[wasm_bindgen]
pub fn split(at: u32) -> bool {
    edit(Command::Split(engine::Split { at }))
}

#[wasm_bindgen]
pub fn time() -> bool {
    edit(Command::Time(engine::Time))
}

#[wasm_bindgen]
pub fn merge(type_: MergeType) -> bool {
    edit(Command::Merge(engine::Merge {
        type_: type_.into(),
    }))
}

#[wasm_bindgen]
pub fn extract() -> bool {
    edit(Command::Extract(engine::Extract))
}

#[wasm_bindgen]
pub fn elevation(ele: &[f64]) -> bool {
    edit(Command::Elevation(engine::Elevation { ele }))
}

#[wasm_bindgen]
pub fn clean(
    west: f64,
    south: f64,
    east: f64,
    north: f64,
    type_: CleanType,
    trkpt: bool,
    wpt: bool,
) -> bool {
    edit(Command::Clean(engine::Clean {
        bounds: LngLatBounds {
            sw: LngLat {
                lng: west,
                lat: south,
            },
            ne: LngLat {
                lng: east,
                lat: north,
            },
        },
        type_: type_.into(),
        trkpt,
        wpt,
    }))
}

// Undo-redo

#[wasm_bindgen]
pub fn undo() -> bool {
    execute(Action::Undo)
}

#[wasm_bindgen]
pub fn redo() -> bool {
    execute(Action::Redo)
}

#[wasm_bindgen]
pub fn can_undo() -> bool {
    with_engine(|e| e.can_undo()).unwrap_or(false)
}

#[wasm_bindgen]
pub fn can_redo() -> bool {
    with_engine(|e| e.can_redo()).unwrap_or(false)
}

// Clipboard

/// Puts the selected elements in the clipboard. Nothing happens when nothing is selected.
#[wasm_bindgen]
pub fn copy() -> bool {
    execute(Action::Copy)
}

/// Like `copy`, but the elements are moved when they are pasted.
#[wasm_bindgen]
pub fn cut() -> bool {
    execute(Action::Cut)
}

/// Pastes the clipboard according to the selection (see `can_paste`). What is pasted is always
/// the elements as they were when they were copied or cut, even if they were changed or deleted
/// since. It can be pasted several times: what was copied is copied again, what was cut is moved
/// the first time (and the clipboard is not cut after that), then it is copied.
#[wasm_bindgen]
pub fn paste() -> bool {
    edit(Command::Paste(engine::Paste))
}

/// Whether the clipboard can be pasted with the current selection.
#[wasm_bindgen]
pub fn can_paste() -> bool {
    with_engine(|e| e.can_paste()).unwrap_or(false)
}

// Moving elements (drag and drop)
//
// Unlike the other functions, the arguments are objects, as they are in the `Selection` and
// `MoveTarget` types: it happens once per drop, and they are much clearer than a list of ids.

fn property(object: &JsValue, key: &str) -> Option<JsValue> {
    Reflect::get(object, &key.into())
        .ok()
        .filter(|value| !value.is_undefined())
}

fn uuid_property(object: &JsValue, key: &str) -> Option<uuid::Uuid> {
    uuid::Uuid::parse_str(&property(object, key)?.as_string()?).ok()
}

fn uuids_property(object: &JsValue, key: &str) -> Option<Vec<uuid::Uuid>> {
    Array::from(&property(object, key)?)
        .iter()
        .map(|id| uuid::Uuid::parse_str(&id.as_string()?).ok())
        .collect()
}

/// The inverse of `selection_object`.
fn parse_selection(value: &JsValue) -> Option<engine::Selection> {
    use engine::Selection as S;
    let file_id = || uuid_property(value, "fileId").map(FileId);
    Some(match property(value, "type")?.as_string()?.as_str() {
        "empty" => S::Empty,
        "file" => S::File {
            file_ids: uuids_property(value, "fileIds")?
                .into_iter()
                .map(FileId)
                .collect(),
        },
        "track" => S::Track {
            file_id: file_id()?,
            trk_ids: uuids_property(value, "trackIds")?
                .into_iter()
                .map(engine::TrackId)
                .collect(),
        },
        "segment" => S::TrackSegment {
            file_id: file_id()?,
            trk_id: engine::TrackId(uuid_property(value, "trackId")?),
            trkseg_ids: uuids_property(value, "segmentIds")?
                .into_iter()
                .map(engine::TrackSegmentId)
                .collect(),
        },
        "waypoints" => S::Waypoints {
            file_id: file_id()?,
        },
        "waypoint" => S::Waypoint {
            file_id: file_id()?,
            wpt_ids: uuids_property(value, "waypointIds")?
                .into_iter()
                .map(engine::WaypointId)
                .collect(),
        },
        _ => return None,
    })
}

fn parse_move_target(value: &JsValue) -> Option<engine::MoveTarget> {
    use engine::MoveTarget as T;
    // a negative index is the start, an infinite one is the end
    let index = property(value, "index")?.as_f64()?.max(0.0) as usize;
    let file_id = || uuid_property(value, "fileId").map(FileId);
    Some(match property(value, "type")?.as_string()?.as_str() {
        "files" => T::Files { index },
        "tracks" => T::Tracks {
            file_id: file_id()?,
            index,
        },
        "segments" => T::Segments {
            file_id: file_id()?,
            trk_id: engine::TrackId(uuid_property(value, "trackId")?),
            index,
        },
        "waypoints" => T::Waypoints {
            file_id: file_id()?,
            index,
        },
        _ => return None,
    })
}

/// Moves elements (given as a `Selection`) to a place of the file tree, keeping their ids, like
/// dragging and dropping them does. The moved elements are selected.
///
/// Files can only go among the files; tracks among the files (each becomes a file) or the tracks
/// of a file; segments among the files (each becomes a file), the tracks of a file (each becomes
/// a track) or the segments of a track; waypoints, or all the waypoints of a file, among the
/// waypoints of a file.
#[wasm_bindgen]
pub fn move_elements(what: Selection, to: MoveTarget) -> bool {
    parse_selection(&what)
        .zip(parse_move_target(&to))
        .is_some_and(|(what, to)| edit(Command::Move(engine::Move { what, to })))
}

// Selection

/// Selects files. `file_ids_bytes`: concatenated 16-byte UUIDs. Unknown files are ignored, and
/// selecting nothing deselects everything. See `SelectMode`.
#[wasm_bindgen]
pub fn select(file_ids_bytes: &[u8], mode: SelectMode) -> bool {
    select_elements(
        file_ids(file_ids_bytes).map(|ids| engine::Selection::File {
            file_ids: ids.into_iter().collect(),
        }),
        mode,
    )
}

/// Selects all the elements of the same kind as the selected ones, in the same place: all the
/// files, the tracks of the file, the segments of the track, the waypoints of the file. All the
/// files when nothing is selected.
#[wasm_bindgen]
pub fn select_all() -> bool {
    execute(Action::SelectAll)
}

/// Moves the selection to the next (`down`) or previous element of the same kind, like the arrow
/// keys do in the file list. With `add` (shift + arrow), the element is added to the selection,
/// otherwise it replaces it.
#[wasm_bindgen]
pub fn arrow_select(down: bool, add: bool) -> bool {
    execute(Action::ArrowSelect { down, add })
}

// The elements below cross as the id of their file (UUID string) and, like the files, as
// concatenated 16-byte UUIDs. What does not exist is ignored. See `SelectMode`: elements are merged
// with the selection when it holds elements of the same kind in the same place (same file, same
// track for segments), otherwise they replace it.

fn select_elements(selection: Option<engine::Selection>, mode: SelectMode) -> bool {
    selection.is_some_and(|selection| {
        execute(Action::Select {
            selection,
            mode: mode.into(),
        })
    })
}

#[wasm_bindgen]
pub fn select_tracks(file_id: &str, track_ids_bytes: &[u8], mode: SelectMode) -> bool {
    select_elements(
        parse_file_id(file_id)
            .zip(uuid_list(track_ids_bytes))
            .map(|(file_id, ids)| engine::Selection::Track {
                file_id,
                trk_ids: ids.into_iter().map(engine::TrackId).collect(),
            }),
        mode,
    )
}

#[wasm_bindgen]
pub fn select_segments(
    file_id: &str,
    track_id: &str,
    segment_ids_bytes: &[u8],
    mode: SelectMode,
) -> bool {
    select_elements(
        parse_file_id(file_id)
            .zip(uuid::Uuid::parse_str(track_id).ok())
            .zip(uuid_list(segment_ids_bytes))
            .map(|((file_id, trk_id), ids)| engine::Selection::TrackSegment {
                file_id,
                trk_id: engine::TrackId(trk_id),
                trkseg_ids: ids.into_iter().map(engine::TrackSegmentId).collect(),
            }),
        mode,
    )
}

/// Selects the node standing for all the waypoints of a file.
#[wasm_bindgen]
pub fn select_waypoint_group(file_id: &str, mode: SelectMode) -> bool {
    select_elements(
        parse_file_id(file_id).map(|file_id| engine::Selection::Waypoints { file_id }),
        mode,
    )
}

#[wasm_bindgen]
pub fn select_waypoints(file_id: &str, waypoint_ids_bytes: &[u8], mode: SelectMode) -> bool {
    select_elements(
        parse_file_id(file_id)
            .zip(uuid_list(waypoint_ids_bytes))
            .map(|(file_id, ids)| engine::Selection::Waypoint {
                file_id,
                wpt_ids: ids.into_iter().map(engine::WaypointId).collect(),
            }),
        mode,
    )
}

// File order and structures
//
// The files are described by one ordered list of ids and one structure object per file, so that
// the UI can react to what changed only: after each action, `last_update` tells which
// structures to (re)read or drop and whether the order changed. Ids are UUID strings. The
// trackpoints of a segment and the waypoints of a file are in the same order as the coordinates
// of their buffers (see below).

#[wasm_bindgen(typescript_custom_section)]
const FILE_STRUCTURE_TS: &str = r#"
export type Selection =
    | { type: 'empty' }
    | { type: 'file'; fileIds: string[] }
    | { type: 'track'; fileId: string; trackIds: string[] }
    | { type: 'segment'; fileId: string; trackId: string; segmentIds: string[] }
    | { type: 'waypoints'; fileId: string }
    | { type: 'waypoint'; fileId: string; waypointIds: string[] };
/**
 * Where moved elements go: a list of the file tree and the position in it, counted among the
 * elements of the list that are not moved.
 */
export type MoveTarget =
    | { type: 'files'; index: number }
    | { type: 'tracks'; fileId: string; index: number }
    | { type: 'segments'; fileId: string; trackId: string; index: number }
    | { type: 'waypoints'; fileId: string; index: number };
/** All the data of a waypoint. The fields it does not have are absent. */
export interface WaypointDetails {
    id: string;
    lng: number;
    lat: number;
    ele: number;
    /** ms since epoch */
    time?: number;
    name?: string;
    desc?: string;
    cmt?: string;
    link?: { href: string; text?: string };
    sym?: string;
}
/** The position, elevation and time of a trackpoint. */
export interface TrackpointDetails {
    lng: number;
    lat: number;
    ele: number;
    /** ms since epoch */
    time?: number;
}
/** What was copied or cut, to be pasted: the kind of the elements and their ids. */
export interface Clipboard {
    type: 'files' | 'tracks' | 'segments' | 'waypoints';
    ids: string[];
    cut: boolean;
}
export interface FilesUpdate {
    orderChanged: boolean;
    selectionChanged: boolean;
    clipboardChanged: boolean;
    /** Files to read the structure of. */
    added: string[];
    /** Files whose structure changed: reread it. */
    modified: string[];
    /** Files that do not exist anymore: drop their structure. */
    removed: string[];
}
export interface FileStructure {
    id: string;
    name: string;
    desc?: string;
    tracks: TrackNode[];
    waypoints: WaypointNode[];
    /** Changes when the waypoints of the file change: refetch their coordinates. */
    waypointsRev: string;
}
/**
 * Global statistics of a file, of the selection, or of a part of it. The optional fields are
 * absent when there is no data for them (no timestamps, no heart rate...).
 */
export interface GlobalStatistics {
    /** km */
    totalDistance: number;
    movingDistance?: number;
    /** seconds */
    totalTime?: number;
    movingTime?: number;
    elevationGain: number;
    elevationLoss: number;
    /** ms since epoch */
    startTime?: number;
    endTime?: number;
    /** km/h */
    totalSpeed?: number;
    movingSpeed?: number;
    /** Average and number of trackpoints having the measure. */
    hr?: { avg: number; count: number };
    cad?: { avg: number; count: number };
    atemp?: { avg: number; count: number };
    power?: { avg: number; count: number };
    /** Absent when there are no trackpoints. */
    bounds?: { west: number; south: number; east: number; north: number };
}
export interface TrackNode {
    id: string;
    name?: string;
    desc?: string;
    /** Style of the track, only present when the file defines it. */
    color?: string;
    opacity?: number;
    width?: number;
    segments: SegmentNode[];
}
export interface SegmentNode {
    id: string;
    /** Changes when the trackpoints of the segment change: refetch their coordinates. */
    rev: string;
    /** Number of trackpoints. */
    length: number;
}
export interface WaypointNode {
    id: string;
    name?: string;
    sym?: string;
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Selection")]
    pub type Selection;
    #[wasm_bindgen(typescript_type = "WaypointDetails | undefined")]
    pub type WaypointDetails;
    #[wasm_bindgen(typescript_type = "TrackpointDetails | undefined")]
    pub type TrackpointDetails;
    #[wasm_bindgen(typescript_type = "MoveTarget")]
    pub type MoveTarget;
    #[wasm_bindgen(typescript_type = "Clipboard | undefined")]
    pub type Clipboard;
    #[wasm_bindgen(typescript_type = "FilesUpdate")]
    pub type FilesUpdate;
    #[wasm_bindgen(typescript_type = "FileStructure | undefined")]
    pub type FileStructure;
    #[wasm_bindgen(typescript_type = "GlobalStatistics | undefined")]
    pub type GlobalStatistics;
    #[wasm_bindgen(typescript_type = "string[]")]
    pub type FileOrder;
    #[wasm_bindgen(typescript_type = "string[]")]
    pub type StringList;
}

fn set(object: &Object, key: &str, value: impl Into<JsValue>) {
    Reflect::set(object, &key.into(), &value.into()).unwrap();
}

fn array<T>(items: &[T], f: impl Fn(&T) -> JsValue) -> Array {
    items.iter().map(f).collect()
}

fn ids(items: &[FileId]) -> Array {
    array(items, |id| id.0.to_string().into())
}

fn named_node(id: uuid::Uuid, name: Option<&str>) -> Object {
    let node = Object::new();
    set(&node, "id", id.to_string());
    if let Some(name) = name {
        set(&node, "name", name);
    }
    node
}

fn structure_object(file: &engine::FileStructure) -> Object {
    let node = named_node(file.id.0, Some(&file.name));
    if let Some(desc) = &file.desc {
        set(&node, "desc", desc.as_str());
    }
    set(
        &node,
        "tracks",
        array(&file.tracks, |trk| {
            let node = named_node(trk.id.0, trk.name.as_deref());
            if let Some(desc) = &trk.desc {
                set(&node, "desc", desc.as_str());
            }
            if let Some(color) = &trk.color {
                set(&node, "color", color.as_str());
            }
            if let Some(opacity) = trk.opacity {
                set(&node, "opacity", opacity);
            }
            if let Some(width) = trk.width {
                set(&node, "width", width);
            }
            set(
                &node,
                "segments",
                array(&trk.segments, |seg| {
                    let node = named_node(seg.id.0, None);
                    set(&node, "rev", seg.rev_id.0.to_string());
                    set(&node, "length", seg.len as f64);
                    node.into()
                }),
            );
            node.into()
        }),
    );
    set(
        &node,
        "waypoints",
        array(&file.waypoints, |wpt| {
            let node = named_node(wpt.id.0, wpt.name.as_deref());
            if let Some(sym) = &wpt.sym {
                set(&node, "sym", sym.as_str());
            }
            node.into()
        }),
    );
    set(&node, "waypointsRev", file.wpt_rev_id.0.to_string());
    node
}

fn with_engine<T>(f: impl FnOnce(&Engine) -> T) -> Option<T> {
    ENGINE.with(|engine| engine.borrow().as_ref().map(f))
}

/// Ids of the files in display order.
#[wasm_bindgen]
pub fn file_order() -> FileOrder {
    let order = with_engine(|e| ids(e.order())).unwrap_or_default();
    order.unchecked_into()
}

/// Structure of a file, `undefined` if the id is unknown.
#[wasm_bindgen]
pub fn file_structure(file_id: &str) -> FileStructure {
    let structure = uuid::Uuid::parse_str(file_id)
        .ok()
        .and_then(|id| {
            with_engine(|e| e.file_structure(&FileId(id)).map(structure_object)).flatten()
        })
        .map_or(JsValue::UNDEFINED, JsValue::from);
    structure.unchecked_into()
}

fn statistics_object(stats: &engine::GlobalStatistics) -> GlobalStatistics {
    let object = Object::new();
    let optional = |key: &str, value: Option<f64>| {
        if let Some(value) = value {
            set(&object, key, value);
        }
    };
    let seconds = |ms: Option<i64>| ms.map(|ms| ms as f64 / 1000.0);
    let average = |key: &str, average: &engine::Average| {
        if let Some(avg) = average.avg() {
            let value = Object::new();
            set(&value, "avg", avg);
            set(&value, "count", f64::from(average.count));
            set(&object, key, value);
        }
    };
    set(&object, "totalDistance", stats.total_distance);
    optional("movingDistance", stats.moving_distance);
    optional("totalTime", seconds(stats.total_time));
    optional("movingTime", seconds(stats.moving_time));
    set(&object, "elevationGain", stats.elevation_gain);
    set(&object, "elevationLoss", stats.elevation_loss);
    optional("startTime", stats.start_time.map(|t| t as f64));
    optional("endTime", stats.end_time.map(|t| t as f64));
    optional("totalSpeed", stats.total_speed());
    optional("movingSpeed", stats.moving_speed());
    average("hr", &stats.hr);
    average("cad", &stats.cad);
    average("atemp", &stats.atemp);
    average("power", &stats.power);
    let (sw, ne) = (&stats.bounds.sw, &stats.bounds.ne);
    if sw.lng <= ne.lng && sw.lat <= ne.lat {
        let bounds = Object::new();
        set(&bounds, "west", sw.lng);
        set(&bounds, "south", sw.lat);
        set(&bounds, "east", ne.lng);
        set(&bounds, "north", ne.lat);
        set(&object, "bounds", bounds);
    }
    object.unchecked_into()
}

/// Global statistics of a file, `undefined` if the id is unknown.
#[wasm_bindgen]
pub fn file_statistics(file_id: &str) -> GlobalStatistics {
    uuid::Uuid::parse_str(file_id)
        .ok()
        .and_then(|id| with_engine(|e| e.file_statistics(&FileId(id))).flatten())
        .map_or(JsValue::UNDEFINED.unchecked_into(), |stats| {
            statistics_object(&stats)
        })
}

/// Global statistics of the whole selection (the arrays of the statistics buffers cover it).
#[wasm_bindgen]
pub fn selection_statistics() -> GlobalStatistics {
    with_stats(|buffer| statistics_object(&buffer.global))
        .unwrap_or_else(|| JsValue::UNDEFINED.unchecked_into())
}

/// Global statistics of the trackpoints from `start` to `end` (both included) of the selection,
/// as indexed by the statistics buffers. `undefined` when the range is not in the selection.
#[wasm_bindgen]
pub fn slice_statistics(start: usize, end: usize) -> GlobalStatistics {
    with_stats(|buffer| buffer.slice(start, end))
        .flatten()
        .map_or(JsValue::UNDEFINED.unchecked_into(), |stats| {
            statistics_object(&stats)
        })
}

fn uuids<T>(items: impl IntoIterator<Item = T>, uuid: impl Fn(T) -> uuid::Uuid) -> Array {
    items
        .into_iter()
        .map(|item| JsValue::from(uuid(item).to_string()))
        .collect()
}

fn selection_object(selection: &engine::Selection) -> Object {
    use engine::Selection as S;
    let object = Object::new();
    match selection {
        S::Empty => set(&object, "type", "empty"),
        S::File { file_ids } => {
            set(&object, "type", "file");
            set(&object, "fileIds", uuids(file_ids, |id| id.0));
        }
        S::Track { file_id, trk_ids } => {
            set(&object, "type", "track");
            set(&object, "fileId", file_id.0.to_string());
            set(&object, "trackIds", uuids(trk_ids, |id| id.0));
        }
        S::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids,
        } => {
            set(&object, "type", "segment");
            set(&object, "fileId", file_id.0.to_string());
            set(&object, "trackId", trk_id.0.to_string());
            set(&object, "segmentIds", uuids(trkseg_ids, |id| id.0));
        }
        S::Waypoints { file_id } => {
            set(&object, "type", "waypoints");
            set(&object, "fileId", file_id.0.to_string());
        }
        S::Waypoint { file_id, wpt_ids } => {
            set(&object, "type", "waypoint");
            set(&object, "fileId", file_id.0.to_string());
            set(&object, "waypointIds", uuids(wpt_ids, |id| id.0));
        }
    }
    object
}

/// The current selection (ids are UUID strings).
#[wasm_bindgen]
pub fn selection() -> Selection {
    with_engine(|e| selection_object(e.selection()))
        .unwrap_or_default()
        .unchecked_into()
}

/// All the data of a waypoint of a file, `undefined` if it does not exist.
#[wasm_bindgen]
pub fn waypoint(file_id: &str, waypoint_id: &str) -> WaypointDetails {
    uuid::Uuid::parse_str(file_id)
        .ok()
        .zip(uuid::Uuid::parse_str(waypoint_id).ok())
        .and_then(|(file_id, id)| {
            with_engine(|e| {
                e.waypoint(&FileId(file_id), &engine::WaypointId(id))
                    .map(|wpt| {
                        let object = Object::new();
                        set(&object, "id", wpt.id.0.to_string());
                        set(&object, "lng", wpt.coordinates.lng);
                        set(&object, "lat", wpt.coordinates.lat);
                        set(&object, "ele", wpt.ele);
                        if let Some(time) = wpt.time {
                            set(&object, "time", time as f64);
                        }
                        for (key, value) in [
                            ("name", &wpt.name),
                            ("desc", &wpt.desc),
                            ("cmt", &wpt.cmt),
                            ("sym", &wpt.sym),
                        ] {
                            if let Some(value) = value {
                                set(&object, key, value.as_str());
                            }
                        }
                        if let Some(link) = &wpt.link {
                            let link_object = Object::new();
                            set(&link_object, "href", link.href.as_str());
                            if let Some(text) = &link.text {
                                set(&link_object, "text", text.as_str());
                            }
                            set(&object, "link", link_object);
                        }
                        JsValue::from(object)
                    })
            })
            .flatten()
        })
        .unwrap_or(JsValue::UNDEFINED)
        .unchecked_into()
}

/// A trackpoint of a segment of a file, `undefined` if it does not exist.
#[wasm_bindgen]
pub fn trackpoint(file_id: &str, segment_id: &str, index: usize) -> TrackpointDetails {
    parse_file_id(file_id)
        .zip(uuid::Uuid::parse_str(segment_id).ok())
        .and_then(|(file_id, segment_id)| {
            with_engine(|e| {
                e.trackpoint(&file_id, &engine::TrackSegmentId(segment_id), index)
                    .map(|pt| {
                        let object = Object::new();
                        set(&object, "lng", pt.coordinates.lng);
                        set(&object, "lat", pt.coordinates.lat);
                        set(&object, "ele", pt.ele);
                        if let Some(time) = pt.time {
                            set(&object, "time", time as f64);
                        }
                        JsValue::from(object)
                    })
            })
            .flatten()
        })
        .unwrap_or(JsValue::UNDEFINED)
        .unchecked_into()
}

/// What was copied or cut and is waiting to be pasted, `undefined` if nothing: the kind of the
/// elements and their ids (UUID strings).
#[wasm_bindgen]
pub fn clipboard() -> Clipboard {
    with_engine(|e| {
        e.clipboard().map_or(JsValue::UNDEFINED, |clipboard| {
            let object = Object::new();
            let (kind, ids) = match clipboard.content.ids() {
                engine::ClipboardIds::Files(ids) => ("files", uuids(ids, |id| id.0)),
                engine::ClipboardIds::Tracks(ids) => ("tracks", uuids(ids, |id| id.0)),
                engine::ClipboardIds::Segments(ids) => ("segments", uuids(ids, |id| id.0)),
                engine::ClipboardIds::Waypoints(ids) => ("waypoints", uuids(ids, |id| id.0)),
            };
            set(&object, "type", kind);
            set(&object, "ids", ids);
            set(&object, "cut", clipboard.cut);
            object.into()
        })
    })
    .unwrap_or(JsValue::UNDEFINED)
    .unchecked_into()
}

/// What the last action changed. Read it right after each action.
#[wasm_bindgen]
pub fn last_update() -> FilesUpdate {
    let update = Object::new();
    with_engine(|e| {
        let diff = e.last_diff().cloned().unwrap_or_default();
        set(&update, "orderChanged", e.order_changed());
        set(&update, "selectionChanged", e.selection_changed());
        set(&update, "clipboardChanged", e.clipboard_changed());
        set(&update, "added", ids(&diff.added));
        set(&update, "modified", ids(&diff.modified));
        set(&update, "removed", ids(&diff.removed));
    });
    update.unchecked_into()
}

// Coordinates buffers
//
// Like the statistics buffers, these are views into wasm memory, invalidated by the next
// command (and any allocation): read or copy them right away. They are flat `[lng, lat, ...]`
// arrays. Compare `rev` / `waypointsRev` of the file structures with the previous ones to know which
// buffers actually changed.

fn coordinates_view(f: impl FnOnce(&Engine) -> Option<&[f64]>) -> Float64Array {
    ENGINE.with(|engine| match engine.borrow().as_ref().and_then(f) {
        Some(coordinates) => unsafe { Float64Array::view(coordinates) },
        None => Float64Array::new_with_length(0),
    })
}

/// Coordinates of the trackpoints of a segment (empty if the id is unknown).
#[wasm_bindgen]
pub fn segment_coordinates(segment_id: &str) -> Float64Array {
    match uuid::Uuid::parse_str(segment_id) {
        Ok(id) => coordinates_view(|e| Some(e.segment_coordinates(&engine::TrackSegmentId(id)))),
        Err(_) => Float64Array::new_with_length(0),
    }
}

/// Coordinates of the waypoints of a file (empty if the id is unknown).
#[wasm_bindgen]
pub fn waypoint_coordinates(file_id: &str) -> Float64Array {
    match uuid::Uuid::parse_str(file_id) {
        Ok(id) => coordinates_view(|e| Some(e.waypoint_coordinates(&FileId(id)))),
        Err(_) => Float64Array::new_with_length(0),
    }
}
