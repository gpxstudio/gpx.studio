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
    /// Selects all the elements of the same kind as the selected ones, in the same place (see
    /// [`Selection::all_at_level`]). Does nothing when there is nothing more to select.
    SelectAll,
    /// Moves the selection to the next (`down`) or previous element of the same kind, like the
    /// arrow keys do in the file list (see [`Selection::neighbour`]). With `add`, the element is
    /// added to the selection (shift + arrow), otherwise it replaces it.
    ArrowSelect {
        down: bool,
        add: bool,
    },
    /// Puts the selected elements in the clipboard, to be pasted by [`crate::Paste`]. Does
    /// nothing when nothing is selected.
    Copy,
    /// Like `Copy`, but the elements are moved instead of copied when they are pasted.
    Cut,
    /// Moves the files to `index` among the other files, in the given order. Not undoable.
    Reorder {
        file_ids: Vec<FileId>,
        index: usize,
    },
}
