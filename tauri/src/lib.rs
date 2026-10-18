//! The desktop shell of gpx.studio. The engine of the files (`gpx-rs/engine`) runs in this
//! process, and the frontend talks to it through the commands of `commands`.

mod bytes;
mod commands;
mod state;
mod store;
mod workspace;

use commands::*;
use tauri::{Emitter, Manager};

/// The engine of the app: each file has its own history, so that undoing only concerns the
/// selected files, and opening or closing a file is not something to undo.
pub(crate) type Engine = gpx_engine::Engine<gpx_engine::PerFileHistory>;

/// The GPX files among what the system gave to the app (the arguments of the command line, when a
/// file is opened with it).
fn gpx_paths(arguments: impl IntoIterator<Item = String>) -> Vec<std::path::PathBuf> {
    arguments
        .into_iter()
        .map(std::path::PathBuf::from)
        .filter(|path| {
            path.is_file()
                && path
                    .extension()
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("gpx"))
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // a single instance of the app: starting it again shows the one that runs (it has to be the
    // first plugin)
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(
        |app, arguments, _directory| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            // a file that was opened with the app, while it runs (Windows, Linux)
            if let Some(state) = app.try_state::<state::AppState>() {
                state.open_external(gpx_paths(arguments.into_iter().skip(1)));
            }
        },
    ));
    register_commands(builder)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let emit: state::Emit = std::sync::Arc::new(move |event, payload| {
                let _ = handle.emit(event, payload);
            });
            // what the engine holds is kept in the data directory of the app
            let directory = app.path().app_data_dir()?.join("store");
            let state = state::AppState::open(directory, emit)?;
            // a file that was opened with the app, which starts (Windows, Linux)
            state.open_external(gpx_paths(std::env::args().skip(1)));
            app.manage(state);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building gpx.studio")
        .run(|_app, _event| {
            // a file that was opened with the app (macOS)
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = _event
                && let Some(state) = _app.try_state::<state::AppState>()
            {
                let paths = urls.iter().filter_map(|url| url.to_file_path().ok());
                state.open_external(gpx_paths(
                    paths.map(|path| path.to_string_lossy().into_owned()),
                ));
            }
        });
}

/// Gives the builder the commands that reach the engine (which it has to be given as `AppState`).
fn register_commands<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        // selection
        selection::select,
        selection::select_all,
        selection::arrow_select,
        selection::select_tracks,
        selection::select_segments,
        selection::select_waypoint_group,
        selection::select_waypoints,
        // files
        files::new_file,
        files::load_files,
        files::duplicate,
        files::delete,
        files::delete_all,
        files::reorder,
        files::copy,
        files::cut,
        files::paste,
        files::move_elements,
        files::undo,
        files::redo,
        // edits and tools
        edit::metadata,
        edit::style,
        edit::new_track,
        edit::new_track_segment,
        edit::new_waypoint,
        edit::move_waypoint,
        edit::delete_waypoint,
        edit::update_waypoint,
        edit::reverse,
        edit::round_trip,
        edit::crop,
        edit::reduce,
        edit::change_timestamps,
        edit::create_artificial_timestamps,
        edit::merge,
        edit::extract,
        edit::elevation,
        edit::clean,
        edit::route,
        edit::insert_anchor,
        edit::change_loop_start,
        edit::split,
        // queries
        queries::file_order,
        queries::file_structure,
        queries::file_statistics,
        queries::selection,
        queries::clipboard,
        queries::can_undo,
        queries::can_redo,
        queries::can_paste,
        queries::waypoint,
        queries::trackpoint,
        queries::export_file,
        queries::exportable_data,
        queries::reduction_distances,
        queries::segment_coordinates,
        queries::waypoint_coordinates,
        // statistics
        statistics::total_distance,
        statistics::slope_segment_starts,
        statistics::slope_segment_slopes,
        statistics::lng,
        statistics::lat,
        statistics::ele,
        statistics::speed,
        statistics::hr,
        statistics::cad,
        statistics::atemp,
        statistics::power,
        statistics::selection_point,
        statistics::selection_statistics,
        statistics::slice_statistics,
        statistics::surface_starts,
        statistics::surface_values,
        statistics::highway_starts,
        statistics::highway_values,
        statistics::sac_scale_starts,
        statistics::sac_scale_values,
        statistics::mtb_scale_starts,
        statistics::mtb_scale_values,
        statistics::surfaces,
        statistics::highways,
        statistics::sac_scales,
        statistics::mtb_scales,
        statistics::anchor_indices,
        statistics::anchor_zooms,
        statistics::segment_starts,
        statistics::segment_ids,
        statistics::routing_revision,
        // storage
        storage::open_storage,
        storage::flush_storage,
        storage::sync_storage,
        storage::set_setting,
        storage::delete_setting,
        // the file system
        disk::workspace_state,
        disk::open_files,
        disk::open_paths,
        disk::keep_files,
        disk::open_folder,
        disk::close_folder,
        disk::close_files,
        disk::save_files,
        disk::save_file_as,
        disk::reload_files,
        disk::export_files,
        disk::list_folder,
        disk::create_folder,
        disk::rename_path,
        disk::move_paths,
        disk::delete_paths,
        // the system
        system::open_url,
        system::reveal_path,
    ])
}

#[cfg(test)]
mod tests;
