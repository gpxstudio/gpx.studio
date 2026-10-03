use crate::{Command, FileId};

/// Everything the frontend can ask the engine to do.
///
/// Only [`Action::Edit`] changes the files (and records an undo step); the others act on the
/// history, on the selection or on the file order.
#[derive(Debug)]
pub enum Action<'a> {
    Edit(Command<'a>),
    Undo,
    Redo,
    Select {
        file_ids: Vec<FileId>,
    },
    AddSelect {
        file_ids: Vec<FileId>,
    },
    SelectAll,
    /// Moves the files to `index` among the other files, in the given order. Not undoable.
    Reorder {
        file_ids: Vec<FileId>,
        index: usize,
    },
}
