use std::rc::Rc;

use super::{Diff, Files, History, diff_between};
use crate::{CommandError, FileId};

/// One history for the whole workspace: each entry is a state of all the files.
#[derive(Debug, Default)]
pub struct GlobalHistory {
    entries: Vec<Files>,
    index: Option<usize>,
    /// Whether the first entry is the state the history starts from, which is not undone: files
    /// restored from the storage.
    floor: bool,
}

impl GlobalHistory {
    /// Whether `entry` holds exactly the files of the current entry.
    fn is_current(&self, entry: &Files) -> bool {
        let current = self.current();
        let len = current.map_or(0, |current| current.len());
        entry.len() == len
            && current.is_none_or(|current| {
                entry
                    .iter()
                    .all(|(id, file)| current.get(id).is_some_and(|c| Rc::ptr_eq(c, file)))
            })
    }

    fn get(&self, index: usize) -> Option<&Files> {
        self.entries.get(index)
    }

    fn push(&mut self, entry: Files) {
        if let Some(i) = self.index {
            self.entries.truncate(i + 1);
        }

        self.entries.push(entry);
        self.index = Some(self.entries.len() - 1);
    }

    fn record_diff<F>(&mut self, f: F) -> Option<Diff>
    where
        F: FnOnce(&mut Self),
    {
        let prev = self.index;
        f(self);
        let cur = self.index;
        if prev == cur {
            return None;
        }
        Some(diff_between(
            prev.map_or_default(|i| self.get(i)),
            cur.map_or_default(|i| self.get(i)),
        ))
    }
}

impl History for GlobalHistory {
    const KEEPS_ORIGINALS: bool = false;

    fn restored(entry: Files) -> Self {
        Self {
            entries: vec![entry],
            index: Some(0),
            floor: true,
        }
    }

    fn current(&self) -> Option<&Files> {
        self.index.map_or_default(|i| self.get(i))
    }

    /// Files are told apart by their identity, not their content.
    fn create_and_push_next<F>(&mut self, f: F) -> Result<Option<Diff>, CommandError>
    where
        F: FnOnce(&mut Files) -> Result<(), CommandError>,
    {
        let mut next = self.current().map_or_default(|c| c.clone());
        f(&mut next)?;
        if self.is_current(&next) {
            return Ok(None);
        }
        Ok(self.record_diff(|history| history.push(next)))
    }

    fn undo(&mut self, _files: &[FileId]) -> Option<Diff> {
        self.record_diff(|history| {
            if let Some(i) = history.index {
                if i == 0 {
                    if !history.floor {
                        history.index = None;
                    }
                } else {
                    history.index = Some(i - 1);
                }
            }
        })
    }

    fn redo(&mut self, _files: &[FileId]) -> Option<Diff> {
        self.record_diff(|history| match history.index {
            Some(i) => {
                if i + 1 < history.entries.len() {
                    history.index = Some(i + 1);
                }
            }
            None => {
                if !history.entries.is_empty() {
                    history.index = Some(0);
                }
            }
        })
    }

    fn can_undo(&self, _files: &[FileId]) -> bool {
        self.index.is_some_and(|i| i > 0 || !self.floor)
    }

    fn can_redo(&self, _files: &[FileId]) -> bool {
        match self.index {
            Some(i) => i + 1 < self.entries.len(),
            None => !self.entries.is_empty(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::File;

    impl GlobalHistory {
        /// A step that is expected not to fail.
        fn push_ok(
            &mut self,
            f: impl FnOnce(&mut Files) -> Result<(), CommandError>,
        ) -> Option<Diff> {
            self.create_and_push_next(f).unwrap()
        }
    }

    #[test]
    fn test_new_file() {
        let mut history = GlobalHistory::default();

        assert!(!history.can_undo(&[]));
        assert!(!history.can_redo(&[]));
        assert!(history.current().is_none());

        let diff = history.push_ok(|e| {
            let file = Rc::new(File::default());
            e.insert(file.id, file);
            Ok(())
        });

        assert!(history.can_undo(&[]));
        assert!(!history.can_redo(&[]));
        assert!(history.current().is_some());

        assert!(diff.is_some());

        let diff = diff.unwrap();
        assert_eq!(diff.added.len(), 1);
        assert!(diff.removed.is_empty());
        assert!(diff.modified.is_empty());
    }

    fn add_file(history: &mut GlobalHistory) -> FileId {
        let file = Rc::new(File::default());
        let id = file.id;
        history
            .push_ok(|e| {
                e.insert(id, file);
                Ok(())
            })
            .unwrap();
        id
    }

    #[test]
    fn test_failed_command_pushes_nothing() {
        let mut history = GlobalHistory::default();
        let diff = history.create_and_push_next(|e| {
            e.insert(FileId::default(), Rc::new(File::default()));
            Err(CommandError::InvalidData("nope".to_string()))
        });
        assert_eq!(diff, Err(CommandError::InvalidData("nope".to_string())));
        assert!(!history.can_undo(&[]));
        assert!(history.current().is_none());
    }

    #[test]
    fn test_undo_redo() {
        let mut history = GlobalHistory::default();
        assert!(history.undo(&[]).is_none());
        assert!(history.redo(&[]).is_none());

        let id = add_file(&mut history);

        let diff = history.undo(&[]).unwrap();
        assert_eq!(diff.removed, vec![id]);
        assert!(diff.added.is_empty());
        assert!(history.current().is_none());
        assert!(!history.can_undo(&[]));
        assert!(history.can_redo(&[]));
        assert!(history.undo(&[]).is_none());

        let diff = history.redo(&[]).unwrap();
        assert_eq!(diff.added, vec![id]);
        assert!(history.current().unwrap().contains_key(&id));
        assert!(history.can_undo(&[]));
        assert!(!history.can_redo(&[]));
        assert!(history.redo(&[]).is_none());
    }

    #[test]
    fn test_modified_and_removed() {
        let mut history = GlobalHistory::default();
        let id = add_file(&mut history);

        let diff = history
            .push_ok(|e| {
                let mut file = (**e.get(&id).unwrap()).clone();
                file.info.name = "renamed".to_string();
                e.insert(id, Rc::new(file));
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.modified, vec![id]);
        assert!(diff.added.is_empty() && diff.removed.is_empty());

        // a step that changes nothing is not a step
        assert!(history.push_ok(|_| Ok(())).is_none());
        assert!(
            history
                .push_ok(|e| {
                    let file = e[&id].clone();
                    e.insert(id, file);
                    Ok(())
                })
                .is_none()
        );

        let diff = history
            .push_ok(|e| {
                e.remove(&id);
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.removed, vec![id]);
        assert!(history.current().unwrap().is_empty());

        // going back restores the renamed file
        history.undo(&[]);
        assert_eq!(history.current().unwrap()[&id].info.name, "renamed");
    }

    #[test]
    fn test_a_file_is_modified_when_it_is_not_the_same_one_anymore() {
        let mut history = GlobalHistory::default();
        let id = add_file(&mut history);

        // a copy, even if it has the same content, is another file for the history: files are
        // told apart by their identity, comparing them would read all of them
        let diff = history
            .push_ok(|e| {
                let copy = (**e.get(&id).unwrap()).clone();
                e.insert(id, Rc::new(copy));
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.modified, vec![id]);

        // and the files that were not replaced are not
        let other = add_file(&mut history);
        let diff = history
            .push_ok(|e| {
                let copy = (**e.get(&other).unwrap()).clone();
                e.insert(other, Rc::new(copy));
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.modified, vec![other]);
    }

    #[test]
    fn test_push_after_undo_drops_redo_branch() {
        let mut history = GlobalHistory::default();
        let first = add_file(&mut history);
        let second = add_file(&mut history);

        history.undo(&[]);
        assert!(history.can_redo(&[]));
        assert!(!history.current().unwrap().contains_key(&second));

        let third = add_file(&mut history);
        assert!(!history.can_redo(&[]));
        assert!(history.redo(&[]).is_none());
        let current = history.current().unwrap();
        assert!(current.contains_key(&first));
        assert!(current.contains_key(&third));
        assert!(!current.contains_key(&second));
    }

    fn restored_entry() -> (Files, FileId) {
        let file = Rc::new(File::default());
        let id = file.id;
        (Files::from([(id, file)]), id)
    }

    #[test]
    fn test_restored_history_starts_from_its_entry() {
        let (entry, id) = restored_entry();
        let mut history = GlobalHistory::restored(entry);

        assert!(history.current().unwrap().contains_key(&id));
        // there is nothing to go back to, nor forward to
        assert!(!history.can_undo(&[]));
        assert!(!history.can_redo(&[]));
        assert!(history.undo(&[]).is_none());
        assert!(history.redo(&[]).is_none());
        assert!(history.current().unwrap().contains_key(&id));
    }

    #[test]
    fn test_restored_history_cannot_undo_an_empty_entry_either() {
        let mut history = GlobalHistory::restored(Files::new());

        assert!(history.current().is_some_and(|files| files.is_empty()));
        assert!(!history.can_undo(&[]));
        assert!(history.undo(&[]).is_none());
        // the history is not the one of an engine that has done nothing
        assert!(history.current().is_some());
    }

    #[test]
    fn test_restored_history_undoes_what_comes_after_it_and_no_further() {
        let (entry, restored) = restored_entry();
        let mut history = GlobalHistory::restored(entry);

        let added = add_file(&mut history);
        assert!(history.can_undo(&[]));
        assert!(!history.can_redo(&[]));
        assert_eq!(history.current().unwrap().len(), 2);

        // back to the restored files
        let diff = history.undo(&[]).unwrap();
        assert_eq!(diff.removed, vec![added]);
        assert!(diff.added.is_empty() && diff.modified.is_empty());
        assert_eq!(history.current().unwrap().len(), 1);
        assert!(history.current().unwrap().contains_key(&restored));
        assert!(!history.can_undo(&[]));
        assert!(history.can_redo(&[]));
        assert!(history.undo(&[]).is_none());
        assert!(history.current().unwrap().contains_key(&restored));

        let diff = history.redo(&[]).unwrap();
        assert_eq!(diff.added, vec![added]);
        assert!(history.can_undo(&[]));
        assert!(!history.can_redo(&[]));

        // and again
        assert!(history.undo(&[]).is_some());
        assert!(history.undo(&[]).is_none());
        assert!(history.current().unwrap().contains_key(&restored));
    }

    #[test]
    fn test_restored_history_removing_its_files_can_be_undone() {
        let (entry, restored) = restored_entry();
        let mut history = GlobalHistory::restored(entry);

        let diff = history
            .push_ok(|e| {
                e.remove(&restored);
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.removed, vec![restored]);
        assert!(history.current().unwrap().is_empty());

        let diff = history.undo(&[]).unwrap();
        assert_eq!(diff.added, vec![restored]);
        assert!(history.current().unwrap().contains_key(&restored));
        assert!(!history.can_undo(&[]));
    }

    #[test]
    fn test_restored_history_push_after_undo_drops_redo_branch() {
        let (entry, restored) = restored_entry();
        let mut history = GlobalHistory::restored(entry);
        add_file(&mut history);
        history.undo(&[]).unwrap();
        assert!(history.can_redo(&[]));

        let other = add_file(&mut history);
        assert!(!history.can_redo(&[]));
        assert!(history.can_undo(&[]));
        let diff = history.undo(&[]).unwrap();
        assert_eq!(diff.removed, vec![other]);
        assert!(history.current().unwrap().contains_key(&restored));
        assert!(!history.can_undo(&[]));
    }
}
