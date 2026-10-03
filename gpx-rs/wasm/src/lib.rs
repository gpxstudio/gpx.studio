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
use js_sys::{Array, Float64Array, Int32Array, Object, Reflect};

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
    static ENGINE: RefCell<Option<Engine>> = RefCell::new(None);
}

fn execute(action: Action) -> bool {
    ENGINE.with(|engine| match engine.borrow_mut().as_mut() {
        Some(engine) => engine.execute(action),
        None => false,
    })
}

fn edit(command: Command) -> bool {
    execute(Action::Edit(command))
}

/// Decodes concatenated 16-byte UUIDs.
fn file_ids(bytes: &[u8]) -> Option<Vec<FileId>> {
    if bytes.len() % 16 != 0 {
        return None;
    }
    bytes
        .chunks_exact(16)
        .map(|chunk| uuid::Uuid::from_slice(chunk).ok().map(FileId))
        .collect()
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
stats_getter!(total_time, Int32Array);
stats_getter!(moving_time, Int32Array);
stats_getter!(speed, Float64Array);
stats_getter!(elevation_gain, Float64Array);
stats_getter!(elevation_loss, Float64Array);
stats_getter!(slope, Float64Array);
stats_getter!(slope_segment_slope, Float64Array);
stats_getter!(slope_segment_distance, Float64Array);

// File commands

#[wasm_bindgen]
pub fn new_file(name: &str) -> bool {
    edit(Command::New(engine::New { name }))
}

#[wasm_bindgen]
pub fn load_file(data: &[u8]) -> bool {
    edit(Command::Load(engine::Load { data }))
}

#[wasm_bindgen]
pub fn duplicate() -> bool {
    edit(Command::Duplicate(engine::Duplicate))
}

#[wasm_bindgen]
pub fn delete() -> bool {
    edit(Command::Delete(engine::Delete))
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

#[wasm_bindgen]
pub fn move_waypoint(lng: f64, lat: f64, ele: f64) -> bool {
    edit(Command::MoveWaypoint(engine::MoveWaypoint {
        lng,
        lat,
        ele,
    }))
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

// Selection

/// `file_ids_bytes`: concatenated 16-byte UUIDs.
#[wasm_bindgen]
pub fn select(file_ids_bytes: &[u8]) -> bool {
    match file_ids(file_ids_bytes) {
        Some(file_ids) => execute(Action::Select { file_ids }),
        None => false,
    }
}

/// `file_ids_bytes`: concatenated 16-byte UUIDs.
#[wasm_bindgen]
pub fn add_select(file_ids_bytes: &[u8]) -> bool {
    match file_ids(file_ids_bytes) {
        Some(file_ids) => execute(Action::AddSelect { file_ids }),
        None => false,
    }
}

#[wasm_bindgen]
pub fn select_all() -> bool {
    execute(Action::SelectAll)
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
export interface FilesUpdate {
    orderChanged: boolean;
    selectionChanged: boolean;
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
    tracks: TrackNode[];
    waypoints: WaypointNode[];
    /** Changes when the waypoints of the file change: refetch their coordinates. */
    waypointsRev: string;
}
export interface TrackNode {
    id: string;
    name?: string;
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
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Selection")]
    pub type Selection;
    #[wasm_bindgen(typescript_type = "FilesUpdate")]
    pub type FilesUpdate;
    #[wasm_bindgen(typescript_type = "FileStructure | undefined")]
    pub type FileStructure;
    #[wasm_bindgen(typescript_type = "string[]")]
    pub type FileOrder;
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
    set(
        &node,
        "tracks",
        array(&file.tracks, |trk| {
            let node = named_node(trk.id.0, trk.name.as_deref());
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
            named_node(wpt.id.0, wpt.name.as_deref()).into()
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

fn uuids<T>(items: impl IntoIterator<Item = T>, uuid: impl Fn(T) -> uuid::Uuid) -> Array {
    items
        .into_iter()
        .map(|item| JsValue::from(uuid(item).to_string()))
        .collect()
}

/// The current selection (ids are UUID strings).
#[wasm_bindgen]
pub fn selection() -> Selection {
    use engine::Selection as S;
    let object = Object::new();
    with_engine(|e| match e.selection() {
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
    });
    object.unchecked_into()
}

/// What the last action changed. Read it right after each action.
#[wasm_bindgen]
pub fn last_update() -> FilesUpdate {
    let update = Object::new();
    with_engine(|e| {
        let diff = e.last_diff().clone().unwrap_or_default();
        set(&update, "orderChanged", e.order_changed());
        set(&update, "selectionChanged", e.selection_changed());
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
