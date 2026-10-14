//! The files of the engine and the file system: picking files and folders, saving, and what the
//! frontend shows of it (see `workspace`).

use std::collections::BTreeMap;
use std::path::PathBuf;

use gpx_engine::api;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use uuid::Uuid;

use crate::state::AppState;
use crate::workspace::{Unsaved, WorkspaceState};

fn paths(picked: Vec<FilePath>) -> Vec<PathBuf> {
    picked
        .into_iter()
        .filter_map(|path| path.into_path().ok())
        .collect()
}

#[tauri::command(async)]
pub fn workspace_state(state: State<AppState>) -> WorkspaceState {
    state.core(|core| core.workspace_state())
}

/// Opens the files that the user picks. Nothing happens if they pick none.
#[tauri::command(async)]
pub fn open_files<R: Runtime>(app: AppHandle<R>, state: State<AppState>) -> api::Outcome {
    let picked = app
        .dialog()
        .file()
        .add_filter("GPX", &["gpx"])
        .blocking_pick_files();
    let Some(picked) = picked else {
        return api::Outcome::failed_none();
    };
    let files = paths(picked);
    state.core(move |core| {
        let outcome = core.workspace.open_files(&mut core.engine, &files, true);
        core.keep_workspace();
        core.persist();
        outcome
    })
}

/// Opens the folder that the user picks: its GPX files are opened and it is watched. The folder
/// that was open is closed, `unsaved` says what to do with its files that have unsaved edits.
#[tauri::command(async)]
pub fn open_folder<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    unsaved: Option<Unsaved>,
) -> Result<api::Outcome, String> {
    let Some(folder) = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|folder| folder.into_path().ok())
    else {
        return Ok(api::Outcome::failed_none());
    };
    state.core(move |core| {
        let outcome = core
            .workspace
            .open_folder(&mut core.engine, &folder, unsaved);
        core.keep_workspace();
        core.persist();
        core.watch();
        core.announce(None);
        outcome
    })
}

/// Closes the folder: it is not watched anymore, and its files are closed. `unsaved` says what to
/// do with the ones that have unsaved edits (they stay without it).
#[tauri::command(async)]
pub fn close_folder(
    state: State<AppState>,
    unsaved: Option<Unsaved>,
) -> Result<api::Outcome, String> {
    state.core(move |core| {
        let outcome = core.workspace.close_folder(&mut core.engine, unsaved);
        core.keep_workspace();
        core.persist();
        core.watch();
        core.announce(None);
        outcome
    })
}

/// Writes files to the disk, replacing what is there. The ones that are not on the disk yet go in
/// the open folder, or where the user says if there is none.
#[tauri::command(async)]
pub fn save_files<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    file_ids: Vec<Uuid>,
) -> Result<(), String> {
    let (ids, unlinked, folder) = {
        let ids = file_ids.clone();
        state.core(move |core| {
            (
                ids.clone(),
                core.workspace.unlinked(&core.engine, &ids),
                core.workspace.folder.clone(),
            )
        })
    };
    let mut chosen = BTreeMap::new();
    // with a folder open, a new file goes in it: nobody is asked
    let to_ask = if folder.is_some() { vec![] } else { unlinked };
    for (id, name) in to_ask {
        let mut dialog = app
            .dialog()
            .file()
            .add_filter("GPX", &["gpx"])
            .set_file_name(format!("{name}.gpx"));
        if let Some(folder) = &folder {
            dialog = dialog.set_directory(folder);
        }
        match dialog
            .blocking_save_file()
            .and_then(|path| path.into_path().ok())
        {
            Some(path) => {
                chosen.insert(id, path);
            }
            // cancelled: the others are not saved either
            None => return Ok(()),
        }
    }
    state.core(move |core| {
        let result = core.workspace.save(&core.engine, &ids, &chosen);
        core.keep_workspace();
        core.announce(None);
        result
    })
}
