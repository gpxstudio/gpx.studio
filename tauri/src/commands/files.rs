//! Creating, loading, deleting, moving, copying and pasting files and their elements, and undoing.

use std::path::PathBuf;

use gpx_engine::api;
use tauri::State;
use tauri::ipc::{InvokeBody, Request};
use uuid::Uuid;

use crate::state::AppState;

#[tauri::command(async)]
pub fn new_file(
    state: State<AppState>,
    name: String,
    lng: Option<f64>,
    lat: Option<f64>,
    ele: Option<f64>,
    folder: Option<PathBuf>,
) -> api::Outcome {
    // in `folder` if it is given, otherwise like the selected file, otherwise in the open folder
    state.core(move |core| core.creating(folder, true, |e| api::new_file(e, &name, lng, lat, ele)))
}

/// The files are in the body, one after the other, the headers `lengths` and `names` (JSON,
/// percent-encoded) telling the number of bytes and the name of each one.
#[tauri::command(async)]
pub fn load_files(state: State<AppState>, request: Request<'_>) -> api::Outcome {
    let InvokeBody::Raw(data) = request.body() else {
        return api::Outcome::failed("the files are missing");
    };
    let header = |key: &str| {
        request
            .headers()
            .get(key)
            .and_then(|value| value.to_str().ok())
            .and_then(percent_decode)
    };
    let (Some(lengths), Some(names)) = (
        header("lengths").and_then(|json| serde_json::from_str::<Vec<usize>>(&json).ok()),
        header("names").and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok()),
    ) else {
        return api::Outcome::failed("the lengths or the names of the files are not valid");
    };
    let data = data.clone();
    state.run(move |e| api::load_files(e, &data, &lengths, &names))
}

fn percent_decode(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = value.get(i + 1..i + 3)?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

#[tauri::command(async)]
pub fn duplicate(state: State<AppState>) -> api::Outcome {
    state.core(|core| core.creating(None, false, api::duplicate))
}

#[tauri::command(async)]
pub fn delete(state: State<AppState>, whole_files: bool) -> api::Outcome {
    state.run(move |e| api::delete(e, whole_files))
}

#[tauri::command(async)]
pub fn delete_all(state: State<AppState>) -> api::Outcome {
    state.run(api::delete_all)
}

#[tauri::command(async)]
pub fn reorder(state: State<AppState>, file_ids: Vec<Uuid>, index: usize) -> api::Outcome {
    state.run(move |e| api::reorder(e, &file_ids, index))
}

#[tauri::command(async)]
pub fn copy(state: State<AppState>) -> api::Outcome {
    state.run(api::copy)
}

#[tauri::command(async)]
pub fn cut(state: State<AppState>) -> api::Outcome {
    state.run(api::cut)
}

#[tauri::command(async)]
pub fn paste(state: State<AppState>) -> api::Outcome {
    state.run(api::paste)
}

#[tauri::command(async)]
pub fn move_elements(
    state: State<AppState>,
    what: api::Selection,
    to: api::MoveTarget,
) -> api::Outcome {
    state.run(move |e| api::move_elements(e, what, to))
}

#[tauri::command(async)]
pub fn undo(state: State<AppState>) -> api::Outcome {
    state.edit(api::undo)
}

#[tauri::command(async)]
pub fn redo(state: State<AppState>) -> api::Outcome {
    state.edit(api::redo)
}
