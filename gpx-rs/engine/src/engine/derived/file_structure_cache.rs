use std::collections::HashMap;

use crate::{Diff, FileId, FileStructure, StackEntry as Files};

/// The structure of each file, only recomputed for the files that changed according to the
/// [`Diff`] of the stack.
#[derive(Debug, Default)]
pub struct FileStructureCache {
    map: HashMap<FileId, FileStructure>,
}

impl FileStructureCache {
    /// Brings the cache in line with `files`, given what changed since the last update.
    pub fn update(&mut self, files: Option<&Files>, diff: Option<&Diff>) {
        if let Some(diff) = diff {
            for id in diff.removed.iter() {
                self.map.remove(id);
            }
            for id in diff.added.iter().chain(&diff.modified) {
                if let Some(file) = files.and_then(|files| files.get(id)) {
                    self.map.insert(*id, FileStructure::new(file));
                }
            }
        }
    }

    pub fn get(&self, id: &FileId) -> Option<&FileStructure> {
        self.map.get(id)
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{Apply, Load, engine::command::fixture::Fixture};

    use super::*;

    #[test]
    fn test_only_files_of_the_diff_are_recomputed() {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        Load { data: &data }.apply(&mut fx.state()).unwrap();
        let (a, b) = (fx.order.0[0], fx.order.0[1]);

        let mut cache = FileStructureCache::default();
        cache.update(
            Some(&fx.files),
            Some(&Diff {
                added: vec![a, b],
                ..Default::default()
            }),
        );
        let before = cache.get(&b).unwrap() as *const FileStructure;

        let mut file = (*fx.files[&a]).clone();
        file.info.name = "renamed".into();
        fx.files.insert(a, Rc::new(file));
        cache.update(
            Some(&fx.files),
            Some(&Diff {
                modified: vec![a],
                ..Default::default()
            }),
        );
        assert_eq!(cache.get(&a).unwrap().name, "renamed");
        assert!(std::ptr::eq(cache.get(&b).unwrap(), before));

        fx.files.remove(&b);
        cache.update(
            Some(&fx.files),
            Some(&Diff {
                removed: vec![b],
                ..Default::default()
            }),
        );
        assert!(cache.get(&b).is_none());
        assert!(cache.get(&a).is_some());
    }
}
