use std::rc::Rc;

use crate::{CommandError, FileId, State, Waypoint, WaypointId, edit_waypoint_chunks};

/// Changes one waypoint of a file with `f`, whatever is selected. Nothing to do if the file or
/// the waypoint does not exist.
pub fn update_waypoint(
    state: &mut State,
    file_id: FileId,
    waypoint_id: WaypointId,
    f: impl Fn(&mut Waypoint),
) -> Result<(), CommandError> {
    let file = state.files.get(&file_id).ok_or(CommandError::NothingToDo)?;
    let mut file = (**file).clone();
    let changed = edit_waypoint_chunks(
        &mut file,
        |wpt| wpt.id == waypoint_id,
        |wpts| {
            wpts.iter_mut()
                .filter(|wpt| wpt.id == waypoint_id)
                .for_each(&f);
            true
        },
    );
    if !changed {
        return Err(CommandError::NothingToDo);
    }
    state.files.insert(file_id, Rc::new(file));
    Ok(())
}
