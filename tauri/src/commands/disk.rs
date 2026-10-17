//! The files of the engine and the file system: picking files and folders, saving, closing, and
//! what the frontend shows of it (see `workspace`).
//!
//! The commands that can lose the edits of a file (closing, opening another folder) take what to do
//! with the files that have some: the frontend asks the user, and the files that have edits stay
//! open if it does not say.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use gpx_engine::{ExportOptions, FileId, api};
use serde::Deserialize;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::{DialogExt, FilePath};
use uuid::Uuid;

use crate::commands::edit;
use crate::state::AppState;
use crate::workspace::{Entry, Unsaved, WorkspaceState, free_path};

fn paths(picked: Vec<FilePath>) -> Vec<PathBuf> {
    picked
        .into_iter()
        .filter_map(|path| path.into_path().ok())
        .collect()
}

/// Asks where to write a GPX file, proposing `file_name` in `folder`. `None` if the user cancelled.
fn ask_save_path<R: Runtime>(
    app: &AppHandle<R>,
    file_name: &str,
    folder: Option<&Path>,
) -> Option<PathBuf> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("GPX", &["gpx"])
        .set_file_name(file_name);
    if let Some(folder) = folder {
        dialog = dialog.set_directory(folder);
    }
    dialog.blocking_save_file()?.into_path().ok()
}

/// Asks for a folder, starting in `folder`. `None` if the user cancelled.
fn ask_folder<R: Runtime>(app: &AppHandle<R>, folder: Option<&Path>) -> Option<PathBuf> {
    let mut dialog = app.dialog().file();
    if let Some(folder) = folder {
        dialog = dialog.set_directory(folder);
    }
    dialog.blocking_pick_folder()?.into_path().ok()
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
    open_paths(state, paths(picked), None)
}

/// Opens files that are on the disk, like the ones of the tree of the open folder. They get selected.
/// With `preview`, a single file is open as a preview (a single click in the tree, see
/// `Workspace::open`); otherwise they are open for good, even the preview.
#[tauri::command(async)]
pub fn open_paths(
    state: State<AppState>,
    paths: Vec<PathBuf>,
    preview: Option<bool>,
) -> api::Outcome {
    state.core(move |core| {
        let outcome = core
            .workspace
            .open(&mut core.engine, &paths, preview.unwrap_or_default());
        core.commit(None);
        outcome
    })
}

/// Writes the files among `ids` that are not the ones on the disk, asking where to put the ones
/// that have no place: the file dialog for a single one, a folder for several of them. Says whether
/// they were written, which is not the case if the user cancelled.
///
/// The files whose file on the disk was replaced are overwritten: the frontend asks before.
fn write_unsaved<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    ids: Vec<Uuid>,
) -> Result<bool, String> {
    let (unlinked, start) = {
        let ids = ids.clone();
        state.core(move |core| {
            (
                core.workspace.unlinked(&core.engine, &ids),
                core.workspace.folder.clone(),
            )
        })
    };
    let mut chosen = BTreeMap::new();
    let mut folder = None;
    match unlinked.as_slice() {
        [] => {}
        [(id, name)] => match ask_save_path(app, &format!("{name}.gpx"), start.as_deref()) {
            Some(path) => {
                chosen.insert(*id, path);
            }
            None => return Ok(false),
        },
        _ => match ask_folder(app, start.as_deref()) {
            Some(path) => folder = Some(path),
            None => return Ok(false),
        },
    }
    state.core(move |core| {
        let result = core
            .workspace
            .save(&mut core.engine, &ids, &chosen, folder.as_deref());
        core.wrote(result)
    })
}

/// Writes files to the disk, replacing what is there. The ones that are not on the disk yet go in
/// their folder, or where the user says. Says whether they were written (`false` if the user
/// cancelled).
#[tauri::command(async)]
pub fn save_files<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    file_ids: Vec<Uuid>,
) -> Result<bool, String> {
    write_unsaved(&app, &state, file_ids)
}

/// Writes a file where the user says, which is where the file is from then on. Says whether it was
/// written (`false` if the user cancelled).
#[tauri::command(async)]
pub fn save_file_as<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    file_id: Uuid,
) -> Result<bool, String> {
    let (name, current, folder) = state.core(move |core| {
        let name = core
            .engine
            .file_structure(&FileId(file_id))
            .map(|structure| structure.name.clone());
        let status = core.workspace_state();
        let file = status.files.get(&file_id.to_string());
        let current = file.and_then(|file| file.path.clone().map(PathBuf::from));
        let folder = file
            .and_then(|file| file.folder.clone().map(PathBuf::from))
            .or(status.folder.map(PathBuf::from));
        (name, current, folder)
    });
    let Some(name) = name else {
        return Ok(false);
    };
    // where the file is, or else where it would be written
    let folder = current
        .as_ref()
        .and_then(|path| path.parent().map(Path::to_path_buf))
        .or(folder);
    let Some(path) = ask_save_path(&app, &format!("{name}.gpx"), folder.as_deref()) else {
        return Ok(false);
    };
    state.core(move |core| {
        let result = core.workspace.save_as(&mut core.engine, file_id, &path);
        core.wrote(result)
    })
}

/// Reads files again from the disk: the edits they have are lost (they are one undo step).
#[tauri::command(async)]
pub fn reload_files(state: State<AppState>, file_ids: Vec<Uuid>) -> Result<api::Outcome, String> {
    state.core(move |core| {
        let outcome = core.workspace.reload(&mut core.engine, &file_ids);
        core.commit(None);
        outcome
    })
}

/// The files among `ids` that are not the ones on the disk, saved first if `unsaved` says so.
/// Says whether to go on, which is not the case if the user cancelled saving them.
fn settle<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    ids: Vec<Uuid>,
    unsaved: Option<Unsaved>,
) -> Result<bool, String> {
    if unsaved != Some(Unsaved::Save) {
        return Ok(true);
    }
    let unsaved_ids = state.core(move |core| core.workspace.unsaved(&core.engine, &ids));
    if unsaved_ids.is_empty() {
        return Ok(true);
    }
    write_unsaved(app, state, unsaved_ids)
}

/// Opens the folder that the user picks, which is watched. Its files are not opened. The folder
/// that was open is closed with its files: `unsaved` says what to do with the ones that have
/// unsaved edits.
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
    let all = state.core(|core| core.workspace.all(&core.engine));
    if !settle(&app, &state, all, unsaved)? {
        return Ok(api::Outcome::failed_none());
    }
    state.core(move |core| {
        let discard = unsaved.is_some();
        let outcome = core
            .workspace
            .open_folder(&mut core.engine, &folder, discard);
        core.commit(None);
        Ok(outcome)
    })
}

/// Closes the folder: it is not watched anymore, and the files are closed with it. `unsaved` says
/// what to do with the ones that have unsaved edits (they stay open without it).
#[tauri::command(async)]
pub fn close_folder<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    unsaved: Option<Unsaved>,
) -> Result<api::Outcome, String> {
    let all = state.core(|core| core.workspace.all(&core.engine));
    if !settle(&app, &state, all, unsaved)? {
        return Ok(api::Outcome::failed_none());
    }
    state.core(move |core| {
        let outcome = core
            .workspace
            .close_folder(&mut core.engine, unsaved.is_some());
        core.commit(None);
        Ok(outcome)
    })
}

/// Closes files. `unsaved` says what to do with the ones that have unsaved edits: they are saved
/// first, or the edits are lost (they stay open without it).
#[tauri::command(async)]
pub fn close_files<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    file_ids: Vec<Uuid>,
    unsaved: Option<Unsaved>,
) -> Result<api::Outcome, String> {
    if !settle(&app, &state, file_ids.clone(), unsaved)? {
        return Ok(api::Outcome::failed_none());
    }
    state.core(move |core| {
        let outcome = core
            .workspace
            .close_files(&mut core.engine, &file_ids, unsaved.is_some());
        core.commit(None);
        Ok(outcome)
    })
}

/// The folders and GPX files that are in a folder of the open folder, or in it (the root of the
/// tree when no path is given).
#[tauri::command(async)]
pub fn list_folder(state: State<AppState>, path: Option<PathBuf>) -> Result<Vec<Entry>, String> {
    state.core(move |core| {
        let Some(path) = path.or_else(|| core.workspace.folder.clone()) else {
            return Ok(vec![]);
        };
        core.workspace.list_folder(&path)
    })
}

/// What the files are exported with, see `ExportOptions`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportArguments {
    time: bool,
    hr: bool,
    cad: bool,
    atemp: bool,
    power: bool,
    osm: bool,
    as_route: bool,
}

impl From<ExportArguments> for ExportOptions {
    fn from(arguments: ExportArguments) -> Self {
        Self {
            time: arguments.time,
            hr: arguments.hr,
            cad: arguments.cad,
            atemp: arguments.atemp,
            power: arguments.power,
            osm: arguments.osm,
            as_route: arguments.as_route,
        }
    }
}

/// Writes copies of files where the user says: a file dialog for a single one, a folder for
/// several. The files stay as they are. Says whether they were written (`false` if the user
/// cancelled).
#[tauri::command(async)]
pub fn export_files<R: Runtime>(
    app: AppHandle<R>,
    state: State<AppState>,
    file_ids: Vec<Uuid>,
    options: ExportArguments,
) -> Result<bool, String> {
    let options = ExportOptions::from(options);
    let files: Vec<(String, Vec<u8>)> = state.core(move |core| {
        file_ids
            .iter()
            .filter_map(|id| {
                let name = core.engine.file_structure(&FileId(*id))?.name.clone();
                Some((name, api::export_file(&core.engine, *id, options)?))
            })
            .collect()
    });
    let write = |path: PathBuf, bytes: &[u8]| {
        crate::store::write_atomically(&path, bytes)
            .map_err(|error| format!("{}: {error}", path.display()))
    };
    match files.as_slice() {
        [] => Ok(false),
        [(name, bytes)] => {
            let Some(path) = ask_save_path(&app, &format!("{name}.gpx"), None) else {
                return Ok(false);
            };
            write(path, bytes).map(|()| true)
        }
        _ => {
            let Some(folder) = ask_folder(&app, None) else {
                return Ok(false);
            };
            let mut written: Vec<PathBuf> = vec![];
            for (name, bytes) in &files {
                let path = free_path(&folder, name, |path| written.iter().any(|w| w == path));
                write(path.clone(), bytes)?;
                written.push(path);
            }
            Ok(true)
        }
    }
}

/// Makes a folder in a folder of the open folder, called `name` (numbered if that is taken). Gives
/// its path.
#[tauri::command(async)]
pub fn create_folder(
    state: State<AppState>,
    parent: PathBuf,
    name: String,
) -> Result<PathBuf, String> {
    state.core(move |core| core.workspace.create_folder(&parent, &name))
}

/// Renames a file or a folder of the open folder. An open file is renamed like in its info (it is
/// selected), which can be undone; the rest is renamed on the disk, and the open files that are in
/// a folder that is renamed follow.
#[tauri::command(async)]
pub fn rename_path(
    state: State<AppState>,
    path: PathBuf,
    name: String,
) -> Result<api::Outcome, String> {
    state.core(move |core| {
        if let Some(id) = core.workspace.linked(&path) {
            let selected = api::select(&mut core.engine, &[id], gpx_engine::SelectMode::Replace);
            let desc = core
                .engine
                .file_structure(&FileId(id))
                .and_then(|structure| structure.desc.clone())
                .unwrap_or_default();
            return Ok(selected.merge(edit::rename_selection(core, name, desc)));
        }
        core.workspace.rename_path(&path, &name)?;
        core.commit(None);
        Ok(api::Outcome::failed_none())
    })
}

/// Moves files and folders of the open folder into a folder of it. The open files follow.
#[tauri::command(async)]
pub fn move_paths(
    state: State<AppState>,
    paths: Vec<PathBuf>,
    folder: PathBuf,
) -> Result<(), String> {
    state.core(move |core| {
        let result = core.workspace.move_paths(&paths, &folder);
        core.commit(None);
        result
    })
}

/// Moves files and folders of the open folder to the trash. The open files that were among them
/// are closed, unless they have edits: they stay open, as gone from the disk.
#[tauri::command(async)]
pub fn delete_paths(state: State<AppState>, paths: Vec<PathBuf>) -> Result<api::Outcome, String> {
    state.core(move |core| {
        let outcome = core
            .workspace
            .delete_paths(&mut core.engine, &paths, to_trash)?;
        core.commit(None);
        Ok(outcome)
    })
}

/// Moves files and folders to the trash of the system.
fn to_trash(paths: &[PathBuf]) -> Result<(), String> {
    #[allow(unused_mut)]
    let mut trash = trash::TrashContext::default();
    // without asking the Finder, which needs a permission
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        trash.set_delete_method(DeleteMethod::NsFileManager);
    }
    trash.delete_all(paths).map_err(|error| {
        eprintln!("the files cannot be deleted: {error}");
        crate::workspace::DELETE_FAILED.to_owned()
    })
}
