//! Creating, loading, deleting, moving, copying and pasting files and their elements, and undoing.

use gpx_engine::{self as engine, Action, Command};
use tauri::ipc::{InvokeBody, Request};
use tauri::State;
use uuid::Uuid;

use crate::dto::*;
use crate::state::{act, edit, AppState};

#[tauri::command(async)]
pub fn new_file(
    state: State<AppState>,
    name: String,
    lng: Option<f64>,
    lat: Option<f64>,
    ele: Option<f64>,
) -> Outcome {
    let trackpoint = lng.zip(lat).map(|(lng, lat)| engine::NewTrackpoint {
        lng,
        lat,
        ele: ele.unwrap_or_default(),
    });
    edit!(
        state,
        Command::New(engine::New {
            name: &name,
            trackpoint,
        })
    )
}

/// The files are in the body, one after the other, the headers `lengths` and `names` (JSON) telling
/// the number of bytes and the name of each one.
#[tauri::command(async)]
pub fn load_files(state: State<AppState>, request: Request<'_>) -> Outcome {
    let InvokeBody::Raw(data) = request.body() else {
        return Outcome::failed("the files are missing");
    };
    let header = |key: &str| {
        request
            .headers()
            .get(key)
            .and_then(|value| value.to_str().ok())
            .and_then(urlencoding_decode)
    };
    let (Some(lengths), Some(names)) = (
        header("lengths").and_then(|json| serde_json::from_str::<Vec<usize>>(&json).ok()),
        header("names").and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok()),
    ) else {
        return Outcome::failed("the lengths or the names of the files are not valid");
    };
    if lengths.len() != names.len() {
        return Outcome::failed(format!(
            "{} lengths for {} names",
            lengths.len(),
            names.len()
        ));
    }
    let (data, mut offset) = (data.clone(), 0);
    let mut ranges = Vec::with_capacity(names.len());
    for (length, name) in lengths.iter().zip(&names) {
        let end = offset + length;
        if end > data.len() {
            return Outcome::failed(format!("the data of {name} is shorter than its length"));
        }
        ranges.push(offset..end);
        offset = end;
    }
    edit!(state, {
        let files = ranges
            .into_iter()
            .zip(&names)
            .map(|(range, name)| engine::Load {
                data: &data[range],
                name,
            })
            .collect();
        Command::LoadFiles(engine::LoadFiles { files })
    })
}

/// Headers are ASCII: the frontend percent-encodes the JSON.
fn urlencoding_decode(value: &str) -> Option<String> {
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
pub fn duplicate(state: State<AppState>) -> Outcome {
    edit!(state, Command::Duplicate(engine::Duplicate))
}

#[tauri::command(async)]
pub fn delete(state: State<AppState>, whole_files: bool) -> Outcome {
    edit!(state, Command::Delete(engine::Delete { whole_files }))
}

#[tauri::command(async)]
pub fn delete_all(state: State<AppState>) -> Outcome {
    edit!(state, Command::DeleteAll(engine::DeleteAll))
}

#[tauri::command(async)]
pub fn reorder(state: State<AppState>, file_ids: Vec<Uuid>, index: usize) -> Outcome {
    act!(
        state,
        Action::Reorder {
            file_ids: file_ids.into_iter().map(engine::FileId).collect(),
            index,
        }
    )
}

#[tauri::command(async)]
pub fn copy(state: State<AppState>) -> Outcome {
    act!(state, Action::Copy)
}

#[tauri::command(async)]
pub fn cut(state: State<AppState>) -> Outcome {
    act!(state, Action::Cut)
}

#[tauri::command(async)]
pub fn paste(state: State<AppState>) -> Outcome {
    edit!(state, Command::Paste(engine::Paste))
}

#[tauri::command(async)]
pub fn move_elements(state: State<AppState>, what: Selection, to: MoveTarget) -> Outcome {
    edit!(
        state,
        Command::Move(engine::Move {
            what: what.into(),
            to: to.into(),
        })
    )
}

#[tauri::command(async)]
pub fn undo(state: State<AppState>) -> Outcome {
    act!(state, Action::Undo)
}

#[tauri::command(async)]
pub fn redo(state: State<AppState>) -> Outcome {
    act!(state, Action::Redo)
}
