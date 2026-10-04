use crate::{Command, FileId, SelectMode, Selection};

/// Everything the frontend can ask the engine to do.
///
/// Only [`Action::Edit`] changes the files (and records an undo step); the others act on the
/// history, on the selection or on the file order.
#[derive(Debug)]
pub enum Action<'a> {
    Edit(Command<'a>),
    Undo,
    Redo,
    /// Selects files, tracks, segments or waypoints (or the waypoints node of one file),
    /// ignoring what does not exist: a selection left with nothing is empty, which deselects
    /// everything. See [`SelectMode`] for how it combines with the current selection.
    Select {
        selection: Selection,
        mode: SelectMode,
    },
    /// Moves the files to `index` among the other files, in the given order. Not undoable.
    Reorder {
        file_ids: Vec<FileId>,
        index: usize,
    },
}
