//! The desktop shell of gpx.studio. The engine of the files (`gpx-rs/engine`) runs in this
//! process, and the frontend talks to it through the commands of `commands`.

mod commands;
mod dto;
mod state;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    with_engine(tauri::Builder::default())
        .run(tauri::generate_context!())
        .expect("error while running gpx.studio");
}

/// Gives the builder the engine and the commands that reach it.
fn with_engine<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .manage(state::AppState::default())
        .invoke_handler(tauri::generate_handler![
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
            routing::route,
            routing::insert_anchor,
            routing::change_loop_start,
            routing::split,
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
            statistics::slope,
            statistics::slope_segment_slope,
            statistics::slope_segment_distance,
            statistics::lng,
            statistics::lat,
            statistics::ele,
            statistics::speed,
            statistics::hr,
            statistics::cad,
            statistics::atemp,
            statistics::power,
            statistics::timestamps,
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
        ])
}

#[cfg(test)]
mod tests;
