use crate::{Command, FileId};

/// Everything the frontend can ask the engine to do.
///
/// Only [`Action::Edit`] changes the files (and records an undo step); the others act on the
/// history or on the selection.
#[derive(Debug)]
pub enum Action<'a> {
    Edit(Command<'a>),
    Undo,
    Redo,
    Select { file_ids: Vec<FileId> },
    AddSelect { file_ids: Vec<FileId> },
    SelectAll,
}
