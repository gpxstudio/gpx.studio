use std::collections::HashSet;

use crate::{FileId, StackEntry as Files};

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct FileOrder(pub Vec<FileId>);

impl FileOrder {
    /// Moves the given files, as a block and in the given order, so that they start at `index`
    /// among the other files (clamped to the end). Unknown ids are ignored. Returns whether the
    /// order changed.
    pub fn move_files(&mut self, file_ids: &[FileId], index: usize) -> bool {
        let mut seen = HashSet::new();
        let moved: Vec<FileId> = file_ids
            .iter()
            .copied()
            .filter(|id| self.0.contains(id) && seen.insert(*id))
            .collect();
        let mut order: Vec<FileId> = self
            .0
            .iter()
            .copied()
            .filter(|id| !seen.contains(id))
            .collect();
        let index = index.min(order.len());
        order.splice(index..index, moved);
        let changed = order != self.0;
        self.0 = order;
        changed
    }

    /// Drops the files that do not exist anymore and appends the new ones at the end.
    pub fn sync(&mut self, files: &Files) {
        self.0.retain(|id| files.contains_key(id));
        let known: HashSet<FileId> = self.0.iter().copied().collect();
        self.0
            .extend(files.keys().filter(|id| !known.contains(id)).copied());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids() -> [FileId; 3] {
        [FileId::default(), FileId::default(), FileId::default()]
    }

    #[test]
    fn test_move_files_as_block_in_given_order() {
        let [a, b, c] = ids();
        let mut order = FileOrder(vec![a, b, c]);
        assert!(order.move_files(&[c, a], 1));
        // index counts among the files that are not moved
        assert_eq!(order.0, vec![b, c, a]);
    }

    #[test]
    fn test_move_files_start_and_clamped_end() {
        let [a, b, c] = ids();
        let mut order = FileOrder(vec![a, b, c]);
        assert!(order.move_files(&[c], 0));
        assert_eq!(order.0, vec![c, a, b]);
        assert!(order.move_files(&[c], 100));
        assert_eq!(order.0, vec![a, b, c]);
    }

    #[test]
    fn test_move_files_ignores_unknown_and_duplicate_ids() {
        let [a, b, c] = ids();
        let mut order = FileOrder(vec![a, b, c]);
        assert!(order.move_files(&[FileId::default(), b, b], 0));
        assert_eq!(order.0, vec![b, a, c]);
    }

    #[test]
    fn test_move_files_unchanged() {
        let [a, b, c] = ids();
        let mut order = FileOrder(vec![a, b, c]);
        assert!(!order.move_files(&[], 0));
        assert!(!order.move_files(&[a, b], 0));
        assert!(!order.move_files(&[FileId::default()], 0));
        assert_eq!(order.0, vec![a, b, c]);
    }

    #[test]
    fn test_sync_drops_missing_and_appends_new_at_the_end() {
        let [a, b, c] = ids();
        let mut files = Files::default();
        for id in [b, c] {
            files.insert(id, Default::default());
        }
        let mut order = FileOrder(vec![a, b]);
        order.sync(&files);
        assert_eq!(order.0, vec![b, c]);
    }
}
