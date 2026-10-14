//! The functions of the frontend's interface to the engine, as Tauri commands. They are the
//! counterparts of the functions that `gpx-rs/wasm` exports, and cross the same data: see
//! `website/src/lib/engine/backend`.
//!
//! The commands that edit the files or change the selection return an `Outcome`.
//! They are `async` (so they run off the main thread), the frontend sends them one after the other.

pub mod edit;
pub mod files;
pub mod queries;
pub mod routing;
pub mod selection;
pub mod statistics;
pub mod storage;
