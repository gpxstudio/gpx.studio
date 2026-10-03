use crate::{Apply, CommandError, LngLatBounds, State};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanType {
    Inside,
    Outside,
}

#[derive(Debug)]
pub struct Clean {
    pub bounds: LngLatBounds,
    pub type_: CleanType,
    pub trkpt: bool,
    pub wpt: bool,
}

impl Apply for Clean {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("clean"))
    }
}
