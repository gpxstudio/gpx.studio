//! Keeping the files and the settings.
//!
//! For now nothing is written: the files only live as long as the app, and so do the settings.
//! The file system storage will go here.

use serde::Serialize;
use tauri::State;

use crate::state::AppState;
use gpx_engine::api::Outcome;

/// What opening the storage found.
#[derive(Serialize)]
pub struct StorageOpened {
    settings: std::collections::BTreeMap<String, String>,
    outcome: Outcome,
}

#[tauri::command(async)]
pub fn open_storage(state: State<AppState>) -> StorageOpened {
    StorageOpened {
        settings: state.settings().clone(),
        outcome: Outcome::failed_none(),
    }
}

/// Resolves when what was changed has been written to the storage.
#[tauri::command(async)]
pub fn flush_storage() {}

/// Reads the files again if they were written by someone else.
#[tauri::command(async)]
pub fn sync_storage() -> Outcome {
    Outcome::failed_none()
}

/// Saves a setting, `value` being its JSON.
#[tauri::command(async)]
pub fn set_setting(state: State<AppState>, key: String, value: String) {
    state.settings().insert(key, value);
}

#[tauri::command(async)]
pub fn delete_setting(state: State<AppState>, key: String) {
    state.settings().remove(&key);
}
