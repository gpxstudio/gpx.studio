//! Frontier between the SvelteKit frontend and the engine.
//!
//! Conventions, chosen to keep calls cheap:
//! - Coordinates and elevations cross as `Float64Array` (`&[f64]`): one memcpy into linear
//!   memory, no per-point calls. `lng`/`lat`/`ele` arrays must have the same length.
//! - File bytes cross as `Uint8Array` (`&[u8]`), strings as `&str`.
//! - File ids cross as one flat `Uint8Array` of concatenated 16-byte UUIDs (no `Array<string>`).
//! - Rectangles cross as four numbers instead of an object.
//! - Every function returns `false` when its arguments are invalid or the command did nothing.
use std::cell::RefCell;

use wasm_bindgen::prelude::*;

use gpx_engine::{self as engine, Action, Command, Engine, FileId, LngLat, LngLatBounds};
use js_sys::{Float64Array, Int32Array};

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
