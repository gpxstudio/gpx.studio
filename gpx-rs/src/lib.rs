//! The GPX engine, and `api`, what the interfaces to it (the web page, the desktop app) share.

pub mod api;
mod core;
mod engine;
mod storage;

pub use core::*;
pub use engine::*;
pub use storage::*;
