//! The interface to the engine, which the interfaces to the frontend share: the web page
//! (`wasm`) and the desktop app (`tauri`) each expose these functions, and only convert what
//! crosses to their own way of passing data.
//!
//! - `commands`: the functions that edit the files or change the selection. Each returns an
//!   `Outcome`: whether anything changed, what changed (to update what the frontend keeps), and why
//!   nothing was done when that is so (the command had nothing to do, the data is invalid, an
//!   argument is wrong).
//! - `queries`: the functions that read the state of the engine.
//! - `dto`: the data that crosses, as serde types.
//!
//! Ids are `Uuid`s: how the frontend sends them (strings, bytes) is for the interfaces to parse.
//! Coordinates and statistics are slices of numbers, which the interfaces copy to typed arrays.

pub mod commands;
pub mod dto;
pub mod queries;

pub use commands::*;
pub use dto::*;
pub use queries::*;
