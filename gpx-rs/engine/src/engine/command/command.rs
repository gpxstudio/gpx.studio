use crate::{Apply, CommandError, State};
use crate::{
    Clean, Crop, Delete, DeleteAll, Duplicate, Elevation, Extract, Load, Merge, Metadata, Move,
    MoveWaypoint, New, NewTrack, NewTrackSegment, NewWaypoint, Paste, Reverse, SpliceTrackpoints,
    Split, Style, Time,
};

/// A user action that edits the files. Each variant wraps the command's own struct, whose
/// effect is implemented in its own file (see `Apply`).
///
/// Bulk data (coordinates, file bytes) is borrowed straight from the wasm-bindgen argument
/// buffers, so a command is built without copying; the engine only copies what it keeps.
#[derive(Debug)]
pub enum Command<'a> {
    New(New<'a>),
    Load(Load<'a>),
    Duplicate(Duplicate),
    Delete(Delete),
    Paste(Paste),
    Move(Move),
    DeleteAll(DeleteAll),
    Metadata(Metadata<'a>),
    Style(Style<'a>),
    NewTrack(NewTrack),
    NewTrackSegment(NewTrackSegment),
    Reverse(Reverse),
    SpliceTrackpoints(SpliceTrackpoints<'a>),
    NewWaypoint(NewWaypoint<'a>),
    MoveWaypoint(MoveWaypoint),
    Crop(Crop),
    Split(Split),
    Time(Time),
    Merge(Merge),
    Extract(Extract),
    Elevation(Elevation<'a>),
    Clean(Clean),
}

impl Apply for Command<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        match self {
            Command::New(c) => c.apply(state),
            Command::Load(c) => c.apply(state),
            Command::Duplicate(c) => c.apply(state),
            Command::Delete(c) => c.apply(state),
            Command::Paste(c) => c.apply(state),
            Command::Move(c) => c.apply(state),
            Command::DeleteAll(c) => c.apply(state),
            Command::Metadata(c) => c.apply(state),
            Command::Style(c) => c.apply(state),
            Command::NewTrack(c) => c.apply(state),
            Command::NewTrackSegment(c) => c.apply(state),
            Command::Reverse(c) => c.apply(state),
            Command::SpliceTrackpoints(c) => c.apply(state),
            Command::NewWaypoint(c) => c.apply(state),
            Command::MoveWaypoint(c) => c.apply(state),
            Command::Crop(c) => c.apply(state),
            Command::Split(c) => c.apply(state),
            Command::Time(c) => c.apply(state),
            Command::Merge(c) => c.apply(state),
            Command::Extract(c) => c.apply(state),
            Command::Elevation(c) => c.apply(state),
            Command::Clean(c) => c.apply(state),
        }
    }
}
