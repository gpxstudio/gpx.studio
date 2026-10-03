use std::{
    collections::{HashMap, HashSet},
    rc::Rc,
};

use crate::{File, FileId};

#[derive(Debug, Default)]
pub struct Stack {
    entries: Vec<StackEntry>,
    index: Option<usize>,
}

impl Stack {
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
                    stack.index = None;
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
        self.index.is_some()
    }

    pub fn can_redo(&self) -> bool {
        match self.index {
            Some(i) => i + 1 < self.entries.len(),
            None => !self.entries.is_empty(),
        }
    }

    fn get(&self, index: usize) -> Option<&StackEntry> {
        if index < self.entries.len() {
            Some(&self.entries[index])
        } else {
            None
        }
    }

    fn push(&mut self, entry: StackEntry) {
        if let Some(i) = self.index {
            if i + 1 < self.entries.len() {
                self.entries.truncate(i + 1);
            }
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
            if before != after {
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

#[derive(Debug, Default)]
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

    // TODO more tests
}
