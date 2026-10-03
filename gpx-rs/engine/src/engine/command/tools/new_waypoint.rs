use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct NewWaypoint<'a> {
    pub lng: f64,
    pub lat: f64,
    pub ele: f64,
    pub name: &'a str,
    pub desc: &'a str,
    pub icon: &'a str,
    pub link: &'a str,
}

impl Apply for NewWaypoint<'_> {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("new waypoint"))
    }
}
