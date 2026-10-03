use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Append<'a> {
    pub lng: &'a [f64],
    pub lat: &'a [f64],
    pub ele: &'a [f64],
}

impl Apply for Append<'_> {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("append"))
    }
}
