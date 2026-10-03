use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Duplicate;

impl Apply for Duplicate {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("duplicate"))
    }
}
