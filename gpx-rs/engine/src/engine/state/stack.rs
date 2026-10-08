use std::{
    collections::{HashMap, HashSet},
    rc::Rc,
};

use crate::{File, FileId};

#[derive(Debug, Default)]
pub struct Stack {
    entries: Vec<StackEntry>,
    index: Option<usize>,
    /// Whether the first entry is the state the stack started from (files restored from the
    /// storage), which is not undone.
    restored: bool,
}

impl Stack {
    /// A stack whose first entry is `entry`, from which nothing can be undone.
    pub fn restored(entry: StackEntry) -> Self {
        Self {
            entries: vec![entry],
            index: Some(0),
            restored: true,
        }
    }

    pub fn current(&self) -> Option<&StackEntry> {
        self.index.map_or_default(|i| self.get(i))
    }

    pub fn create_and_push_next<F>(&mut self, f: F) -> Option<Diff>
    where
        F: FnOnce(&mut StackEntry) -> Result<(), String>,
    {
        self.record_diff(|stack| {
            let mut next = stack.current().map_or_default(|c| c.clone());
            if f(&mut next).is_ok() {
                stack.push(next);
            }
        })
    }

    pub fn undo(&mut self) -> Option<Diff> {
        self.record_diff(|stack| {
            if let Some(i) = stack.index {
                if i == 0 {
                    if !stack.restored {
                        stack.index = None;
                    }
                } else {
                    stack.index = Some(i - 1);
                }
            }
        })
    }

    pub fn redo(&mut self) -> Option<Diff> {
        self.record_diff(|stack| match stack.index {
            Some(i) => {
                if i + 1 < stack.entries.len() {
                    stack.index = Some(i + 1);
                }
            }
            None => {
                if !stack.entries.is_empty() {
                    stack.index = Some(0);
                }
            }
        })
    }

    pub fn can_undo(&self) -> bool {
        self.index.is_some_and(|i| i > 0 || !self.restored)
    }

    pub fn can_redo(&self) -> bool {
        match self.index {
            Some(i) => i + 1 < self.entries.len(),
            None => !self.entries.is_empty(),
        }
    }

    fn get(&self, index: usize) -> Option<&StackEntry> {
        self.entries.get(index)
    }

    fn push(&mut self, entry: StackEntry) {
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
        let prev = prev.map_or_default(|i| self.get(i));
        let cur = cur.map_or_default(|i| self.get(i));
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
        Some(Diff {
            added: cur_ids.difference(&prev_ids).copied().collect(),
            removed: prev_ids.difference(&cur_ids).copied().collect(),
            modified,
        })
    }
}

pub type StackEntry = HashMap<FileId, Rc<File>>;

/// Which files were added, removed or modified by a change of the current stack entry.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Diff {
    pub added: Vec<FileId>,
    pub removed: Vec<FileId>,
    pub modified: Vec<FileId>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_file() {
        let mut stack = Stack::default();

        assert!(!stack.can_undo());
        assert!(!stack.can_redo());
        assert!(stack.current().is_none());

        let diff = stack.create_and_push_next(|e| {
            let file = Rc::new(File::default());
            e.insert(file.id, file);
            Ok(())
        });

        assert!(stack.can_undo());
        assert!(!stack.can_redo());
        assert!(stack.current().is_some());

        assert!(diff.is_some());

        let diff = diff.unwrap();
        assert_eq!(diff.added.len(), 1);
        assert!(diff.removed.is_empty());
        assert!(diff.modified.is_empty());
    }

    fn add_file(stack: &mut Stack) -> FileId {
        let file = Rc::new(File::default());
        let id = file.id;
        stack
            .create_and_push_next(|e| {
                e.insert(id, file);
                Ok(())
            })
            .unwrap();
        id
    }

    #[test]
    fn test_failed_command_pushes_nothing() {
        let mut stack = Stack::default();
        let diff = stack.create_and_push_next(|e| {
            e.insert(FileId::default(), Rc::new(File::default()));
            Err("nope".to_string())
        });
        assert!(diff.is_none());
        assert!(!stack.can_undo());
        assert!(stack.current().is_none());
    }

    #[test]
    fn test_undo_redo() {
        let mut stack = Stack::default();
        assert!(stack.undo().is_none());
        assert!(stack.redo().is_none());

        let id = add_file(&mut stack);

        let diff = stack.undo().unwrap();
        assert_eq!(diff.removed, vec![id]);
        assert!(diff.added.is_empty());
        assert!(stack.current().is_none());
        assert!(!stack.can_undo());
        assert!(stack.can_redo());
        assert!(stack.undo().is_none());

        let diff = stack.redo().unwrap();
        assert_eq!(diff.added, vec![id]);
        assert!(stack.current().unwrap().contains_key(&id));
        assert!(stack.can_undo());
        assert!(!stack.can_redo());
        assert!(stack.redo().is_none());
    }

    #[test]
    fn test_modified_and_removed() {
        let mut stack = Stack::default();
        let id = add_file(&mut stack);

        let diff = stack
            .create_and_push_next(|e| {
                let mut file = (**e.get(&id).unwrap()).clone();
                file.info.name = "renamed".to_string();
                e.insert(id, Rc::new(file));
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.modified, vec![id]);
        assert!(diff.added.is_empty() && diff.removed.is_empty());

        // an unchanged file is not reported as modified
        let diff = stack.create_and_push_next(|_| Ok(())).unwrap();
        assert!(diff.modified.is_empty());

        let diff = stack
            .create_and_push_next(|e| {
                e.remove(&id);
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.removed, vec![id]);
        assert!(stack.current().unwrap().is_empty());

        // going back restores the renamed file
        stack.undo();
        assert_eq!(stack.current().unwrap()[&id].info.name, "renamed");
    }

    #[test]
    fn test_a_file_is_modified_when_it_is_not_the_same_one_anymore() {
        let mut stack = Stack::default();
        let id = add_file(&mut stack);

        // a copy, even if it has the same content, is another file for the stack: files are
        // told apart by their identity, comparing them would read all of them
        let diff = stack
            .create_and_push_next(|e| {
                let copy = (**e.get(&id).unwrap()).clone();
                e.insert(id, Rc::new(copy));
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.modified, vec![id]);

        // and the files that were not replaced are not
        let other = add_file(&mut stack);
        let diff = stack
            .create_and_push_next(|e| {
                let copy = (**e.get(&other).unwrap()).clone();
                e.insert(other, Rc::new(copy));
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.modified, vec![other]);
    }

    #[test]
    fn test_push_after_undo_drops_redo_branch() {
        let mut stack = Stack::default();
        let first = add_file(&mut stack);
        let second = add_file(&mut stack);

        stack.undo();
        assert!(stack.can_redo());
        assert!(!stack.current().unwrap().contains_key(&second));

        let third = add_file(&mut stack);
        assert!(!stack.can_redo());
        assert!(stack.redo().is_none());
        let current = stack.current().unwrap();
        assert!(current.contains_key(&first));
        assert!(current.contains_key(&third));
        assert!(!current.contains_key(&second));
    }

    fn restored_entry() -> (StackEntry, FileId) {
        let file = Rc::new(File::default());
        let id = file.id;
        (StackEntry::from([(id, file)]), id)
    }

    #[test]
    fn test_restored_stack_starts_from_its_entry() {
        let (entry, id) = restored_entry();
        let mut stack = Stack::restored(entry);

        assert!(stack.current().unwrap().contains_key(&id));
        // there is nothing to go back to, nor forward to
        assert!(!stack.can_undo());
        assert!(!stack.can_redo());
        assert!(stack.undo().is_none());
        assert!(stack.redo().is_none());
        assert!(stack.current().unwrap().contains_key(&id));
    }

    #[test]
    fn test_restored_stack_cannot_undo_an_empty_entry_either() {
        let mut stack = Stack::restored(StackEntry::new());

        assert!(stack.current().is_some_and(|files| files.is_empty()));
        assert!(!stack.can_undo());
        assert!(stack.undo().is_none());
        // the stack is not the one of an engine that has done nothing
        assert!(stack.current().is_some());
    }

    #[test]
    fn test_restored_stack_undoes_what_comes_after_it_and_no_further() {
        let (entry, restored) = restored_entry();
        let mut stack = Stack::restored(entry);

        let added = add_file(&mut stack);
        assert!(stack.can_undo());
        assert!(!stack.can_redo());
        assert_eq!(stack.current().unwrap().len(), 2);

        // back to the restored files
        let diff = stack.undo().unwrap();
        assert_eq!(diff.removed, vec![added]);
        assert!(diff.added.is_empty() && diff.modified.is_empty());
        assert_eq!(stack.current().unwrap().len(), 1);
        assert!(stack.current().unwrap().contains_key(&restored));
        assert!(!stack.can_undo());
        assert!(stack.can_redo());
        assert!(stack.undo().is_none());
        assert!(stack.current().unwrap().contains_key(&restored));

        let diff = stack.redo().unwrap();
        assert_eq!(diff.added, vec![added]);
        assert!(stack.can_undo());
        assert!(!stack.can_redo());

        // and again
        assert!(stack.undo().is_some());
        assert!(stack.undo().is_none());
        assert!(stack.current().unwrap().contains_key(&restored));
    }

    #[test]
    fn test_restored_stack_removing_its_files_can_be_undone() {
        let (entry, restored) = restored_entry();
        let mut stack = Stack::restored(entry);

        let diff = stack
            .create_and_push_next(|e| {
                e.remove(&restored);
                Ok(())
            })
            .unwrap();
        assert_eq!(diff.removed, vec![restored]);
        assert!(stack.current().unwrap().is_empty());

        let diff = stack.undo().unwrap();
        assert_eq!(diff.added, vec![restored]);
        assert!(stack.current().unwrap().contains_key(&restored));
        assert!(!stack.can_undo());
    }

    #[test]
    fn test_restored_stack_push_after_undo_drops_redo_branch() {
        let (entry, restored) = restored_entry();
        let mut stack = Stack::restored(entry);
        add_file(&mut stack);
        stack.undo().unwrap();
        assert!(stack.can_redo());

        let other = add_file(&mut stack);
        assert!(!stack.can_redo());
        assert!(stack.can_undo());
        let diff = stack.undo().unwrap();
        assert_eq!(diff.removed, vec![other]);
        assert!(stack.current().unwrap().contains_key(&restored));
        assert!(!stack.can_undo());
    }
}
