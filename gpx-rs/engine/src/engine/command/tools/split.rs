use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct Split {
    pub at: u32,
}

impl Apply for Split {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("split"))
    }
}
