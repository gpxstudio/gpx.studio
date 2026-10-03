use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Time;

impl Apply for Time {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("time"))
    }
}
