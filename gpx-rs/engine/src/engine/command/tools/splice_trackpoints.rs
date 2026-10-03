use crate::{Apply, CommandError, State};

#[derive(Debug)]
pub struct SpliceTrackpoints<'a> {
    pub start: u32,
    pub end: u32,
    pub lng: &'a [f64],
    pub lat: &'a [f64],
    pub ele: &'a [f64],
}

impl Apply for SpliceTrackpoints<'_> {
    fn apply(self, _state: &mut State) -> Result<(), CommandError> {
        // TODO
        Err(CommandError::NotImplemented("splice_trackpoints"))
    }
}
