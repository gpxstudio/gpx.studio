use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Delete;

impl Apply for Delete {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("delete"))
    }
}
