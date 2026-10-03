use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Reverse;

impl Apply for Reverse {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("reverse"))
    }
}
