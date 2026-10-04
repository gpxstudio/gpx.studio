//! Shared helpers for the tests of the commands.

use std::collections::HashSet;

use crate::{Clipboard, FileId, FileOrder, Selection, StackEntry, State};

#[derive(Default)]
pub struct Fixture {
    pub files: StackEntry,
    pub selection: Selection,
    pub order: FileOrder,
    pub clipboard: Option<Clipboard>,
}

impl Fixture {
    pub fn state(&mut self) -> State<'_> {
        State {
            files: &mut self.files,
            selection: &mut self.selection,
            order: &mut self.order,
            clipboard: &mut self.clipboard,
        }
    }

    /// Ids of the selected files, empty unless the selection is a file selection.
    pub fn selected_files(&self) -> HashSet<FileId> {
        match &self.selection {
            Selection::File { file_ids } => file_ids.clone(),
            _ => HashSet::new(),
        }
    }
}
