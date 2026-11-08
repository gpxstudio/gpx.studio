//! Frontier between the SvelteKit frontend and the engine.
//!
//! Conventions, chosen to keep calls cheap:
//! - Coordinates and elevations cross as `Float64Array` (`&[f64]`): one memcpy into linear
//!   memory, no per-point calls. `lng`/`lat`/`ele` arrays must have the same length.
//! - File bytes cross as `Uint8Array` (`&[u8]`), strings as `&str`.
//! - File ids cross as one flat `Uint8Array` of concatenated 16-byte UUIDs (no `Array<string>`).
//! - Rectangles cross as four numbers instead of an object.
//! - Ids read from the file tree are hyphenated UUID strings; the functions reading buffers take
//!   them as such.
//! - The functions that edit the files or change the selection return an `Outcome`: whether they
//!   changed anything, what changed (to update what the page keeps), and why nothing was done when
//!   that is so (the command had nothing to do, the data is invalid, an argument is wrong).
//!
//! The functions are grouped by what they do: `commands` edit the files, `queries` read the state
//! of the engine, `selection` changes what is selected, and `persistence` keeps the files and the
//! settings in the browser. `session` holds the engine they all talk to, `convert` turns engine
//! types into JS objects and back, and `ts` declares the TypeScript types of those objects.

mod command;
mod convert;
mod idb;
mod ids;
mod persistence;
mod queries;
mod selection;
mod session;
mod ts;
mod types;

#[cfg(all(test, target_arch = "wasm32"))]
mod tests;
