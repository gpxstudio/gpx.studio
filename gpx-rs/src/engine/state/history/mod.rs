use std::{
    collections::{HashMap, HashSet},
    fmt::Debug,
    rc::Rc,
};

use crate::{CommandError, File, FileId};

mod global;
mod per_file;

pub use global::*;
pub use per_file::*;

pub type Files = HashMap<FileId, Rc<File>>;

/// What the engine can undo and redo, and the files it holds as a result.
///
/// There are two ways to keep it, which the engine can use interchangeably:
/// - [`GlobalHistory`] has one history for the whole workspace: every step is a state of all the
///   files, and undoing goes back to the previous one, whatever the files it concerns. Opening and
///   closing files are steps too.
/// - [`PerFileHistory`] has one history for each file, which starts when the file appears and ends
///   when it disappears. Undoing only concerns the files that are asked for, and files appearing
///   or disappearing are never undone.
///
/// Files are told apart by their identity (`Rc::ptr_eq`), not their content.
pub trait History: Default + Debug {
    /// Whether the commands that replace files by others (split into files, extract, merge) must
    /// keep the files they start from, and produce new ones. A history that forgets a file when it
    /// goes could not undo the command, which a history of the whole workspace can.
    const KEEPS_ORIGINALS: bool;

    /// A history that starts from `files`, which cannot be undone.
    fn restored(files: Files) -> Self;

    /// The current state of the files, `None` if there is none yet.
    fn current(&self) -> Option<&Files>;

    /// Applies `f` to a copy of the current files and makes the copy the new current state.
    ///
    /// Nothing is recorded, and `None` is returned, if `f` fails (the error is returned) or if it
    /// leaves every file as it was: a step that undoes nothing is not worth a place in the history.
    fn create_and_push_next<F>(&mut self, f: F) -> Result<Option<Diff>, CommandError>
    where
        F: FnOnce(&mut Files) -> Result<(), CommandError>;

    /// Goes back one step. A per-file history does it for each of the given `files` (and ignores
    /// the ones it does not know), a global one ignores them.
    fn undo(&mut self, files: &[FileId]) -> Option<Diff>;

    /// Goes forward one step, for the same files as [`History::undo`].
    fn redo(&mut self, files: &[FileId]) -> Option<Diff>;

    /// Whether [`History::undo`] would do something for these `files`.
    fn can_undo(&self, files: &[FileId]) -> bool;

    /// Whether [`History::redo`] would do something for these `files`.
    fn can_redo(&self, files: &[FileId]) -> bool;

    /// Names a file `name` in all its states, as if it had always been called so: there is nothing
    /// to undo. Says that the file changed, `None` if there is no such file or it is called so.
    fn rename(&mut self, id: FileId, name: &str) -> Option<Diff>;
}

/// Names the states of a file: the ones that were shared stay shared (a state that several
/// entries have is renamed once), and the ones that are called so already are kept.
pub(super) struct Renamer<'a> {
    name: &'a str,
    renamed: HashMap<*const File, Rc<File>>,
}

impl<'a> Renamer<'a> {
    pub(super) fn new(name: &'a str) -> Self {
        Self {
            name,
            renamed: HashMap::new(),
        }
    }

    pub(super) fn rename(&mut self, file: &Rc<File>) -> Rc<File> {
        if file.info.name == self.name {
            return file.clone();
        }
        let name = self.name;
        self.renamed
            .entry(Rc::as_ptr(file))
            .or_insert_with(|| {
                let mut renamed = (**file).clone();
                renamed.info.name = name.to_owned();
                Rc::new(renamed)
            })
            .clone()
    }
}

/// Which files were added, removed or modified by a change of the current files.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Diff {
    pub added: Vec<FileId>,
    pub removed: Vec<FileId>,
    pub modified: Vec<FileId>,
}

impl Diff {
    pub fn is_empty(&self) -> bool {
        self.added.is_empty() && self.removed.is_empty() && self.modified.is_empty()
    }
}

/// Which files differ between two states.
pub fn diff_between(prev: Option<&Files>, cur: Option<&Files>) -> Diff {
    let prev_ids: HashSet<FileId> = prev.map_or_default(|e| e.keys().copied().collect());
    let cur_ids: HashSet<FileId> = cur.map_or_default(|e| e.keys().copied().collect());
    let mut modified = vec![];
    for id in prev_ids.intersection(&cur_ids) {
        let before = prev.map_or_default(|e| e.get(id));
        let after = cur.map_or_default(|e| e.get(id));
        if !before.zip(after).is_some_and(|(b, a)| Rc::ptr_eq(b, a)) {
            modified.push(*id);
        }
    }
    Diff {
        added: cur_ids.difference(&prev_ids).copied().collect(),
        removed: prev_ids.difference(&cur_ids).copied().collect(),
        modified,
    }
}
