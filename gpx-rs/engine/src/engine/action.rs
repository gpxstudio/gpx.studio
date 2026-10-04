use crate::{Command, FileId, Selection};

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
    /// everything. With `add`, the elements are added to the current selection when they can
    /// be merged with it (see [`Selection::extend`]), otherwise they replace it.
    Select {
        selection: Selection,
        add: bool,
    },
    /// Moves the files to `index` among the other files, in the given order. Not undoable.
    Reorder {
        file_ids: Vec<FileId>,
        index: usize,
    },
}
