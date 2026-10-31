//! What the frontend knows of the storage, which is kept by the engine thread (see `state`).

use std::collections::BTreeMap;

use gpx_engine::api;
use serde::Serialize;
use tauri::State;

use crate::state::AppState;

/// What opening the storage found.
#[derive(Serialize)]
pub struct StorageOpened {
    settings: BTreeMap<String, String>,
    /// All the files of the engine as added: the frontend starts with none.
    outcome: api::Outcome,
}

/// The files were restored when the app started: the frontend is told about all of them.
#[tauri::command(async)]
pub fn open_storage(state: State<AppState>) -> StorageOpened {
    StorageOpened {
        settings: state.storage().settings(),
        outcome: state.read(api::Outcome::everything),
    }
}

/// Resolves when what was changed has been written to the storage, which is the case when a command
/// returns.
#[tauri::command(async)]
pub fn flush_storage() {}

/// There is no other writer.
#[tauri::command(async)]
pub fn sync_storage() -> api::Outcome {
    api::Outcome::failed_none()
}

/// Saves a setting, `value` being its JSON.
#[tauri::command(async)]
pub fn set_setting(state: State<AppState>, key: String, value: String) {
    state.put_setting(&key, &value);
}

#[tauri::command(async)]
pub fn delete_setting(state: State<AppState>, key: String) {
    state.delete_setting(&key);
}
