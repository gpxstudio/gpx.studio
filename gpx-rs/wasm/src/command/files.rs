//! Creating, loading, deleting, moving, copying and pasting files and their elements.

use gpx_engine::{self as engine, Action, Command};
use wasm_bindgen::prelude::*;

use crate::convert::*;
use crate::ids::*;
use crate::session::*;
use crate::ts::*;

// File commands

/// Creates a file and selects it. With `lng` and `lat`, it starts with a track and a segment that
/// hold that trackpoint (at `ele`, 0 by default).
#[wasm_bindgen]
pub fn new_file(name: &str, lng: Option<f64>, lat: Option<f64>, ele: Option<f64>) -> Outcome {
    let trackpoint = lng.zip(lat).map(|(lng, lat)| engine::NewTrackpoint {
        lng,
        lat,
        ele: ele.unwrap_or_default(),
    });
    edit(Command::New(engine::New { name, trackpoint }))
}

/// Loads files as a single command (one undo step). The files are in `data`, one after the
/// other, `lengths` being the number of bytes of each one. `names`: the name of each file when
/// its data has none (the name on disk, without extension). The files that cannot be read are
/// skipped, the first one that was read is selected.
#[wasm_bindgen]
pub fn load_files(data: &[u8], lengths: &[u32], names: Vec<String>) -> Outcome {
    if lengths.len() != names.len() {
        return fail(format!(
            "{} lengths for {} names",
            lengths.len(),
            names.len()
        ));
    }
    let mut files = Vec::with_capacity(names.len());
    let mut offset = 0;
    for (length, name) in lengths.iter().zip(&names) {
        let end = offset + *length as usize;
        let Some(data) = data.get(offset..end) else {
            return fail(format!("the data of {name} is shorter than its length"));
        };
        files.push(engine::Load { data, name });
        offset = end;
    }
    edit(Command::LoadFiles(engine::LoadFiles { files }))
}

#[wasm_bindgen]
pub fn duplicate() -> Outcome {
    edit(Command::Duplicate(engine::Duplicate))
}

/// Deletes the selected elements. With `whole_files`, the files holding the selected elements are
/// deleted instead, even if only a track or a waypoint is selected.
#[wasm_bindgen]
pub fn delete(whole_files: bool) -> Outcome {
    edit(Command::Delete(engine::Delete { whole_files }))
}

#[wasm_bindgen]
pub fn delete_all() -> Outcome {
    edit(Command::DeleteAll(engine::DeleteAll))
}

/// Moves the files to `index` among the other files, in the given order (not undoable).
/// `file_ids_bytes`: concatenated 16-byte UUIDs.
#[wasm_bindgen]
pub fn reorder(file_ids_bytes: &[u8], index: usize) -> Outcome {
    match file_ids(file_ids_bytes) {
        Some(file_ids) => execute(Action::Reorder { file_ids, index }),
        None => fail("the file ids are not a list of UUIDs"),
    }
}

// Clipboard

/// Puts the selected elements in the clipboard. Nothing happens when nothing is selected.
#[wasm_bindgen]
pub fn copy() -> Outcome {
    execute(Action::Copy)
}

/// Like `copy`, but the elements are moved when they are pasted.
#[wasm_bindgen]
pub fn cut() -> Outcome {
    execute(Action::Cut)
}

/// Pastes the clipboard according to the selection (see `can_paste`). What is pasted is always
/// the elements as they were when they were copied or cut, even if they were changed or deleted
/// since. It can be pasted several times: what was copied is copied again, what was cut is moved
/// the first time (and the clipboard is not cut after that), then it is copied.
#[wasm_bindgen]
pub fn paste() -> Outcome {
    edit(Command::Paste(engine::Paste))
}

/// Whether the clipboard can be pasted with the current selection.
#[wasm_bindgen]
pub fn can_paste() -> bool {
    with_engine(|e| e.can_paste()).unwrap_or(false)
}

/// Moves elements (given as a `Selection`) to a place of the file tree, keeping their ids, like
/// dragging and dropping them does. The moved elements are selected.
///
/// Files can only go among the files; tracks among the files (each becomes a file) or the tracks
/// of a file; segments among the files (each becomes a file), the tracks of a file (each becomes
/// a track) or the segments of a track; waypoints, or all the waypoints of a file, among the
/// waypoints of a file.
#[wasm_bindgen]
pub fn move_elements(what: Selection, to: MoveTarget) -> Outcome {
    match parse_selection(&what).zip(parse_move_target(&to)) {
        Some((what, to)) => edit(Command::Move(engine::Move { what, to })),
        None => fail("the elements or the target are not valid"),
    }
}
