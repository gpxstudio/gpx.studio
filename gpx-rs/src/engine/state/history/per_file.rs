use std::rc::Rc;

use super::{Diff, Files, History, diff_between};
use crate::{CommandError, File, FileId};

use std::collections::HashMap;

/// One history for each file, which begins with the state the file appears in (loaded, created,
/// produced by a command...) and ends when the file disappears: a file coming or going is never
/// undone, only what happens to it in between.
#[derive(Debug, Default)]
pub struct PerFileHistory {
    current: Files,
    stacks: HashMap<FileId, FileHistory>,
}

/// The successive states of a file, the first one being where it starts from.
#[derive(Debug)]
struct FileHistory {
    entries: Vec<Rc<File>>,
    index: usize,
}

impl FileHistory {
    fn new(file: Rc<File>) -> Self {
        Self {
            entries: vec![file],
            index: 0,
        }
    }

    fn current(&self) -> &Rc<File> {
        &self.entries[self.index]
    }

    fn push(&mut self, file: Rc<File>) {
        self.entries.truncate(self.index + 1);
        self.entries.push(file);
        self.index = self.entries.len() - 1;
    }

    fn can_undo(&self) -> bool {
        self.index > 0
    }

    fn can_redo(&self) -> bool {
        self.index + 1 < self.entries.len()
    }
}

impl PerFileHistory {
    /// Moves each of the files one step back (`forward` false) or forward, and says which ones
    /// moved.
    fn step(&mut self, files: &[FileId], forward: bool) -> Option<Diff> {
        let mut modified: Vec<FileId> = vec![];
        for id in files {
            let Some(history) = self.stacks.get_mut(id) else {
                continue;
            };
            if modified.contains(id) {
                continue;
            }
            if forward && history.can_redo() {
                history.index += 1;
            } else if !forward && history.can_undo() {
                history.index -= 1;
            } else {
                continue;
            }
            self.current.insert(*id, history.current().clone());
            modified.push(*id);
        }
        (!modified.is_empty()).then(|| Diff {
            modified,
            ..Default::default()
        })
    }

    fn any(&self, files: &[FileId], f: impl Fn(&FileHistory) -> bool) -> bool {
        files.iter().any(|id| self.stacks.get(id).is_some_and(&f))
    }
}

impl History for PerFileHistory {
    const KEEPS_ORIGINALS: bool = true;

    fn restored(files: Files) -> Self {
        let stacks = files
            .iter()
            .map(|(id, file)| (*id, FileHistory::new(file.clone())))
            .collect();
        Self {
            current: files,
            stacks,
        }
    }

    fn current(&self) -> Option<&Files> {
        Some(&self.current)
    }

    fn create_and_push_next<F>(&mut self, f: F) -> Result<Option<Diff>, CommandError>
    where
        F: FnOnce(&mut Files) -> Result<(), CommandError>,
    {
        let mut next = self.current.clone();
        f(&mut next)?;
        let diff = diff_between(Some(&self.current), Some(&next));
        if diff.is_empty() {
            return Ok(None);
        }
        for id in &diff.removed {
            self.stacks.remove(id);
        }
        for id in &diff.added {
            self.stacks.insert(*id, FileHistory::new(next[id].clone()));
        }
        for id in &diff.modified {
            match self.stacks.get_mut(id) {
                Some(history) => history.push(next[id].clone()),
                None => {
                    self.stacks.insert(*id, FileHistory::new(next[id].clone()));
                }
            }
        }
        self.current = next;
        Ok(Some(diff))
    }

    fn undo(&mut self, files: &[FileId]) -> Option<Diff> {
        self.step(files, false)
    }

    fn redo(&mut self, files: &[FileId]) -> Option<Diff> {
        self.step(files, true)
    }

    fn can_undo(&self, files: &[FileId]) -> bool {
        self.any(files, FileHistory::can_undo)
    }

    fn can_redo(&self, files: &[FileId]) -> bool {
        self.any(files, FileHistory::can_redo)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn push(history: &mut PerFileHistory, f: impl FnOnce(&mut Files)) -> Option<Diff> {
        history
            .create_and_push_next(|files| {
                f(files);
                Ok(())
            })
            .unwrap()
    }

    fn add_file(history: &mut PerFileHistory) -> FileId {
        let file = Rc::new(File::default());
        let id = file.id;
        push(history, |files| {
            files.insert(id, file);
        })
        .unwrap();
        id
    }

    fn rename(history: &mut PerFileHistory, id: FileId, name: &str) -> Option<Diff> {
        push(history, |files| {
            let mut file = (**files.get(&id).unwrap()).clone();
            file.info.name = name.to_string();
            files.insert(id, Rc::new(file));
        })
    }

    fn name(history: &PerFileHistory, id: FileId) -> String {
        history.current().unwrap()[&id].info.name.clone()
    }

    #[test]
    fn test_a_new_file_cannot_be_undone() {
        let mut history = PerFileHistory::default();
        assert!(history.current().unwrap().is_empty());
        let id = add_file(&mut history);

        assert!(!history.can_undo(&[id]));
        assert!(!history.can_redo(&[id]));
        assert!(history.undo(&[id]).is_none());
        assert!(history.current().unwrap().contains_key(&id));
    }

    #[test]
    fn test_undo_redo_of_a_file() {
        let mut history = PerFileHistory::default();
        let id = add_file(&mut history);
        let before = name(&history, id);
        let diff = rename(&mut history, id, "renamed").unwrap();
        assert_eq!(diff.modified, vec![id]);
        assert!(history.can_undo(&[id]));

        let diff = history.undo(&[id]).unwrap();
        assert_eq!(diff.modified, vec![id]);
        assert!(diff.added.is_empty() && diff.removed.is_empty());
        assert_eq!(name(&history, id), before);
        assert!(!history.can_undo(&[id]));
        assert!(history.can_redo(&[id]));

        history.redo(&[id]).unwrap();
        assert_eq!(name(&history, id), "renamed");
        assert!(history.redo(&[id]).is_none());
    }

    #[test]
    fn test_only_the_given_files_are_undone() {
        let mut history = PerFileHistory::default();
        let a = add_file(&mut history);
        let b = add_file(&mut history);
        rename(&mut history, a, "a");
        rename(&mut history, b, "b");

        assert!(history.can_undo(&[a]));
        assert!(!history.can_undo(&[]));
        assert!(history.undo(&[]).is_none());

        let diff = history.undo(&[a]).unwrap();
        assert_eq!(diff.modified, vec![a]);
        assert_ne!(name(&history, a), "a");
        assert_eq!(name(&history, b), "b");
        // a has nothing more to undo, b still has
        assert!(!history.can_undo(&[a]));
        assert!(history.can_undo(&[a, b]));
        assert!(history.undo(&[a]).is_none());
    }

    #[test]
    fn test_several_files_are_undone_each_by_its_own_step() {
        let mut history = PerFileHistory::default();
        let a = add_file(&mut history);
        let b = add_file(&mut history);
        rename(&mut history, a, "a1");
        rename(&mut history, a, "a2");
        rename(&mut history, b, "b1");

        let diff = history.undo(&[a, b, a]).unwrap();
        assert_eq!(diff.modified, vec![a, b]);
        // a is only moved once, even if it is asked for twice
        assert_eq!(name(&history, a), "a1");
        assert_ne!(name(&history, b), "b1");
    }

    #[test]
    fn test_a_step_after_an_undo_drops_the_redo_branch_of_that_file_only() {
        let mut history = PerFileHistory::default();
        let a = add_file(&mut history);
        let b = add_file(&mut history);
        rename(&mut history, a, "a1");
        rename(&mut history, b, "b1");
        history.undo(&[a, b]).unwrap();

        rename(&mut history, a, "a2");
        assert!(!history.can_redo(&[a]));
        assert!(history.can_redo(&[b]));
    }

    #[test]
    fn test_a_step_that_changes_nothing_is_not_recorded() {
        let mut history = PerFileHistory::default();
        let id = add_file(&mut history);
        assert!(push(&mut history, |_| {}).is_none());
        assert!(!history.can_undo(&[id]));
    }

    #[test]
    fn test_failed_command_pushes_nothing() {
        let mut history = PerFileHistory::default();
        let id = add_file(&mut history);
        let result = history.create_and_push_next(|files| {
            files.remove(&id);
            Err(CommandError::InvalidData("nope".to_string()))
        });
        assert_eq!(result, Err(CommandError::InvalidData("nope".to_string())));
        assert!(history.current().unwrap().contains_key(&id));
    }

    #[test]
    fn test_removing_a_file_drops_its_history() {
        let mut history = PerFileHistory::default();
        let id = add_file(&mut history);
        rename(&mut history, id, "renamed");

        let diff = push(&mut history, |files| {
            files.remove(&id);
        })
        .unwrap();
        assert_eq!(diff.removed, vec![id]);
        assert!(history.current().unwrap().is_empty());
        assert!(!history.can_undo(&[id]));
        assert!(history.undo(&[id]).is_none());
        assert!(history.current().unwrap().is_empty());
    }

    #[test]
    fn test_a_file_that_comes_back_starts_over() {
        let mut history = PerFileHistory::default();
        let file = Rc::new(File::default());
        let id = file.id;
        push(&mut history, |files| {
            files.insert(id, file.clone());
        });
        rename(&mut history, id, "renamed");
        push(&mut history, |files| {
            files.remove(&id);
        });
        push(&mut history, |files| {
            files.insert(id, file.clone());
        });
        assert!(!history.can_undo(&[id]));
    }

    #[test]
    fn test_restored_files_cannot_be_undone() {
        let file = Rc::new(File::default());
        let id = file.id;
        let mut history = PerFileHistory::restored(Files::from([(id, file)]));
        assert!(history.current().unwrap().contains_key(&id));
        assert!(!history.can_undo(&[id]));
        assert!(history.undo(&[id]).is_none());

        rename(&mut history, id, "renamed");
        assert!(history.can_undo(&[id]));
        history.undo(&[id]).unwrap();
        assert!(!history.can_undo(&[id]));
    }
}
