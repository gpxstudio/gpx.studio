use std::rc::Rc;

use crate::{File, Waypoint, WaypointChunk};

/// Edits the waypoints of the chunks containing a waypoint accepted by `filter`.
///
/// `f` receives a copy of the chunk's waypoints and returns whether it changed them. A
/// changed chunk is replaced by a new one (with a new id, so that derived data is recomputed)
/// and chunks left empty are dropped. Returns whether anything changed.
pub fn edit_waypoint_chunks(
    file: &mut File,
    filter: impl Fn(&Waypoint) -> bool,
    mut f: impl FnMut(&mut Vec<Waypoint>) -> bool,
) -> bool {
    let mut changed = false;
    let mut chunks = Vec::with_capacity(file.wpt.len());
    for chunk in file.wpt.drain(..) {
        if !chunk.wpt.iter().any(&filter) {
            chunks.push(chunk);
            continue;
        }
        let mut wpt = chunk.wpt.clone();
        if !f(&mut wpt) {
            chunks.push(chunk);
            continue;
        }
        changed = true;
        if !wpt.is_empty() {
            chunks.push(Rc::new(WaypointChunk {
                wpt,
                ..Default::default()
            }));
        }
    }
    file.wpt = chunks;
    if changed {
        file.wpt_rev_id = Default::default();
    }
    changed
}
