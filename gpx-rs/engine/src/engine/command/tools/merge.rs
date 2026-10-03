use crate::{Apply, CommandError, State};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MergeType {
    Connect,
    Group,
}

#[derive(Debug)]
pub struct Merge {
    pub type_: MergeType,
}

impl Apply for Merge {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("merge"))
    }
}
