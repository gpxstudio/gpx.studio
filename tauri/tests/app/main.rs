//! The tests of the desktop app. They are integration tests, in a single binary, rather than unit
//! tests: on Windows, only test binaries can be given the manifest that the app needs to start
//! (see `build.rs`).

mod commands;
mod store;
mod workspace;

use gpx_studio_desktop_lib::state::AppState;

/// An engine that keeps its data in a directory of its own, and has nobody to tell.
fn temporary_state() -> AppState {
    let directory = std::env::temp_dir().join(format!("gpx-studio-{}", uuid::Uuid::new_v4()));
    AppState::open(directory, std::sync::Arc::new(|_, _| {})).expect("the storage can be opened")
}
