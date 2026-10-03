use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Elevation<'a> {
    pub ele: &'a [f64],
}

impl Apply for Elevation<'_> {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("elevation"))
    }
}
