use crate::Diff;

/// What an action did, returned by [`crate::Engine::execute`] (unless it was refused) and
/// [`crate::Engine::restore`].
///
/// It describes that action only: it is not kept by the engine, so reading it never depends on
/// what was done since.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Outcome {
    /// Whether anything changed: the files, the selection, the order of the files or the
    /// clipboard.
    pub changed: bool,
    /// Which files the action added, removed or modified, in the order of the files. `None` when
    /// the files are as they were.
    pub diff: Option<Diff>,
    pub order_changed: bool,
    pub selection_changed: bool,
    pub clipboard_changed: bool,
}
