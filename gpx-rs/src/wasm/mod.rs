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

use crate::{CleanType, Command, Engine, FileId, LngLat, LngLatBounds, MergeType};

thread_local! {
    static ENGINE: RefCell<Option<Engine>> = RefCell::new(None);
}

fn execute(command: Command) -> bool {
    ENGINE.with(|engine| match engine.borrow_mut().as_mut() {
        Some(engine) => engine.execute(command),
        None => false,
    })
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

// File commands

#[wasm_bindgen]
pub fn new_file(name: &str) -> bool {
    execute(Command::New { name })
}

#[wasm_bindgen]
pub fn load_file(data: &[u8]) -> bool {
    execute(Command::Load { data })
}

#[wasm_bindgen]
pub fn duplicate() -> bool {
    execute(Command::Duplicate)
}

#[wasm_bindgen]
pub fn delete() -> bool {
    execute(Command::Delete)
}

#[wasm_bindgen]
pub fn delete_all() -> bool {
    execute(Command::DeleteAll)
}

// Edit commands

#[wasm_bindgen]
pub fn metadata(name: &str, desc: &str) -> bool {
    execute(Command::Metadata { name, desc })
}

#[wasm_bindgen]
pub fn style(color: Option<String>, opacity: Option<f64>, width: Option<f64>) -> bool {
    execute(Command::Style {
        color: color.as_deref(),
        opacity,
        width,
    })
}

#[wasm_bindgen]
pub fn new_track() -> bool {
    execute(Command::NewTrack)
}

#[wasm_bindgen]
pub fn new_track_segment() -> bool {
    execute(Command::NewTrackSegment)
}

// Tools

#[wasm_bindgen]
pub fn reverse() -> bool {
    execute(Command::Reverse)
}

#[wasm_bindgen]
pub fn append(lng: &[f64], lat: &[f64], ele: &[f64]) -> bool {
    same_len(lng, lat, ele) && execute(Command::Append { lng, lat, ele })
}

#[wasm_bindgen]
pub fn replace(start: u32, end: u32, lng: &[f64], lat: &[f64], ele: &[f64]) -> bool {
    start <= end
        && same_len(lng, lat, ele)
        && execute(Command::Replace {
            start,
            end,
            lng,
            lat,
            ele,
        })
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
    execute(Command::NewWaypoint {
        lng,
        lat,
        ele,
        name,
        desc,
        icon,
        link,
    })
}

#[wasm_bindgen]
pub fn move_waypoint(lng: f64, lat: f64, ele: f64) -> bool {
    execute(Command::MoveWaypoint { lng, lat, ele })
}

#[wasm_bindgen]
pub fn crop(start: u32, end: u32) -> bool {
    start <= end && execute(Command::Crop { start, end })
}

#[wasm_bindgen]
pub fn split(at: u32) -> bool {
    execute(Command::Split { at })
}

#[wasm_bindgen]
pub fn time() -> bool {
    execute(Command::Time)
}

#[wasm_bindgen]
pub fn merge(type_: MergeType) -> bool {
    execute(Command::Merge { type_ })
}

#[wasm_bindgen]
pub fn extract() -> bool {
    execute(Command::Extract)
}

#[wasm_bindgen]
pub fn elevation(ele: &[f64]) -> bool {
    execute(Command::Elevation { ele })
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
    execute(Command::Clean {
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
        type_,
        trkpt,
        wpt,
    })
}

// Undo-redo

#[wasm_bindgen]
pub fn undo() -> bool {
    execute(Command::Undo)
}

#[wasm_bindgen]
pub fn redo() -> bool {
    execute(Command::Redo)
}

// Selection

/// `file_ids`: concatenated 16-byte UUIDs.
#[wasm_bindgen]
pub fn select(file_ids_bytes: &[u8]) -> bool {
    match file_ids(file_ids_bytes) {
        Some(file_ids) => execute(Command::Select { file_ids }),
        None => false,
    }
}

/// `file_ids`: concatenated 16-byte UUIDs.
#[wasm_bindgen]
pub fn add_select(file_ids_bytes: &[u8]) -> bool {
    match file_ids(file_ids_bytes) {
        Some(file_ids) => execute(Command::AddSelect { file_ids }),
        None => false,
    }
}

#[wasm_bindgen]
pub fn select_all() -> bool {
    execute(Command::SelectAll)
}
