use std::{collections::HashMap, rc::Rc};

use uuid::Uuid;

use crate::gpx::GPXFile;

#[derive(Default)]
pub struct Stack {
    entries: Vec<StackEntry>,
    index: Option<usize>,
}

impl Stack {
    pub fn current(&self) -> Option<&StackEntry> {
        match self.index {
            Some(i) => Some(&self.entries[i]),
            None => None,
        }
    }

    pub fn create_and_push_next<F>(&mut self, f: F)
    where
        F: FnOnce(&mut StackEntry) -> bool,
    {
        let mut next = self.current().map_or_default(|c| c.clone());
        if f(&mut next) {
            self.push(next);
        }
    }

    // pub fn update(&mut self, files: &[Rc<GPXFile>], ids: &[GPXFileId]) {
    //     let mut next = match self.current() {
    //         Some(current) => current.clone(),
    //         None => StackEntry::default(),
    //     };
    //     for (file, id) in files.iter().zip(ids) {
    //         next.insert(*id, file.clone());
    //     }
    //     self.push(next);
    // }

    // pub fn delete(&mut self, files: &[GPXFileId]) {
    //     if let Some(current) = self.current() {
    //         let mut next = current.clone();
    //         for file in files {
    //             next.remove(file);
    //         }
    //         self.push(next);
    //     }
    // }

    pub fn can_undo(&self) -> bool {
        self.index.is_some()
    }

    pub fn can_redo(&self) -> bool {
        match self.index {
            Some(i) => i + 1 < self.entries.len(),
            None => !self.entries.is_empty(),
        }
    }

    pub fn undo(&mut self) {
        if let Some(i) = self.index {
            if i == 0 {
                self.index = None;
            } else {
                self.index = Some(i - 1);
            }
        }
    }

    pub fn redo(&mut self) {
        match self.index {
            Some(i) => {
                if i + 1 < self.entries.len() {
                    self.index = Some(i + 1);
                }
            }
            None => {
                if !self.entries.is_empty() {
                    self.index = Some(0);
                }
            }
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
}

pub type StackEntry = HashMap<Uuid, Rc<GPXFile>>;
