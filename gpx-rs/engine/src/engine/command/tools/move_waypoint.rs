use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct MoveWaypoint {
    pub lng: f64,
    pub lat: f64,
    pub ele: f64,
}

impl Apply for MoveWaypoint {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("move waypoint"))
    }
}
