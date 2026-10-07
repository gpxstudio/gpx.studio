use crate::{Apply, CommandError, State};
use crate::{
    ChangeLoopStart, Clean, Crop, Delete, DeleteAll, DeleteWaypoint, Duplicate, EditWaypoint,
    Elevation, Extract, InsertAnchor, Load, LoadFiles, Merge, Metadata, Move, MoveWaypoint, New,
    NewTrack, NewTrackSegment, NewWaypoint, Paste, Reverse, RoundTrip, Route, Split, Style, Time,
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
    LoadFiles(LoadFiles<'a>),
    Duplicate(Duplicate),
    Delete(Delete),
    Paste(Paste),
    Move(Move),
    DeleteAll(DeleteAll),
    DeleteWaypoint(DeleteWaypoint),
    Metadata(Metadata<'a>),
    Style(Style<'a>),
    NewTrack(NewTrack),
    NewTrackSegment(NewTrackSegment),
    Reverse(Reverse),
    RoundTrip(RoundTrip),
    Route(Route<'a>),
    NewWaypoint(NewWaypoint<'a>),
    EditWaypoint(EditWaypoint<'a>),
    MoveWaypoint(MoveWaypoint),
    Crop(Crop),
    Split(Split),
    Time(Time),
    Merge(Merge),
    Extract(Extract),
    InsertAnchor(InsertAnchor),
    Elevation(Elevation<'a>),
    Clean(Clean),
    ChangeLoopStart(ChangeLoopStart),
}

impl Apply for Command<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        match self {
            Command::New(c) => c.apply(state),
            Command::Load(c) => c.apply(state),
            Command::LoadFiles(c) => c.apply(state),
            Command::Duplicate(c) => c.apply(state),
            Command::Delete(c) => c.apply(state),
            Command::Paste(c) => c.apply(state),
            Command::Move(c) => c.apply(state),
            Command::DeleteAll(c) => c.apply(state),
            Command::DeleteWaypoint(c) => c.apply(state),
            Command::Metadata(c) => c.apply(state),
            Command::Style(c) => c.apply(state),
            Command::NewTrack(c) => c.apply(state),
            Command::NewTrackSegment(c) => c.apply(state),
            Command::Reverse(c) => c.apply(state),
            Command::RoundTrip(c) => c.apply(state),
            Command::Route(c) => c.apply(state),
            Command::NewWaypoint(c) => c.apply(state),
            Command::EditWaypoint(c) => c.apply(state),
            Command::MoveWaypoint(c) => c.apply(state),
            Command::Crop(c) => c.apply(state),
            Command::Split(c) => c.apply(state),
            Command::Time(c) => c.apply(state),
            Command::Merge(c) => c.apply(state),
            Command::Extract(c) => c.apply(state),
            Command::InsertAnchor(c) => c.apply(state),
            Command::Elevation(c) => c.apply(state),
            Command::Clean(c) => c.apply(state),
            Command::ChangeLoopStart(c) => c.apply(state),
        }
    }
}
