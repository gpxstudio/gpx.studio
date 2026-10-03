use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Crop {
    pub start: u32,
    pub end: u32,
}

impl Apply for Crop {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("crop"))
    }
}
