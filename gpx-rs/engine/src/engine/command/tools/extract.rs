use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Extract;

impl Apply for Extract {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("extract"))
    }
}
