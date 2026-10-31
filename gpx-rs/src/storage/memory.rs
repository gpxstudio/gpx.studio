use std::cell::RefCell;
use std::collections::HashMap;

use crate::{
    Batch, ChunkKey, ChunkKind, CommitError, FileId, Revision, Storage, StorageError, StoredData,
};

/// A storage that lives as long as the session. It is what an engine without a host storage uses,
/// and what the tests use.
#[derive(Debug, Default)]
pub struct MemoryStorage {
    state: RefCell<State>,
}

#[derive(Debug, Default)]
struct State {
    head: Revision,
    files: HashMap<FileId, Vec<u8>>,
    chunks: HashMap<ChunkKey, Vec<u8>>,
    order: Option<Vec<u8>>,
    settings: HashMap<String, String>,
}

/// How much there is in a storage.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StorageCounts {
    pub files: usize,
    pub trackpoint_chunks: usize,
    pub waypoint_chunks: usize,
}

impl MemoryStorage {
    /// How many files and chunks are stored.
    pub fn counts(&self) -> StorageCounts {
        let state = self.state.borrow();
        let chunks = |kind| state.chunks.keys().filter(|key| key.kind == kind).count();
        StorageCounts {
            files: state.files.len(),
            trackpoint_chunks: chunks(ChunkKind::Trackpoints),
            waypoint_chunks: chunks(ChunkKind::Waypoints),
        }
    }
}

impl Storage for MemoryStorage {
    async fn load(&self) -> Result<StoredData, StorageError> {
        let state = self.state.borrow();
        Ok(StoredData {
            files: state.files.iter().map(|(k, v)| (*k, v.clone())).collect(),
            chunks: state.chunks.iter().map(|(k, v)| (*k, v.clone())).collect(),
            order: state.order.clone(),
            head: state.head,
        })
    }

    async fn head(&self) -> Result<Revision, StorageError> {
        Ok(self.state.borrow().head)
    }

    async fn commit(&self, batch: &Batch) -> Result<Revision, CommitError> {
        let mut state = self.state.borrow_mut();
        if state.head != batch.expect_head {
            return Err(CommitError::Stale { head: state.head });
        }
        state.files.extend(batch.put_files.iter().cloned());
        for id in &batch.delete_files {
            state.files.remove(id);
        }
        state.chunks.extend(batch.put_chunks.iter().cloned());
        for key in &batch.delete_chunks {
            state.chunks.remove(key);
        }
        if let Some(order) = &batch.order {
            state.order = Some(order.clone());
        }
        state.head = state.head.next();
        Ok(state.head)
    }

    async fn load_settings(&self) -> Result<Vec<(String, String)>, StorageError> {
        let state = self.state.borrow();
        Ok(state
            .settings
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect())
    }

    async fn put_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        self.state
            .borrow_mut()
            .settings
            .insert(key.to_owned(), value.to_owned());
        Ok(())
    }

    async fn delete_setting(&self, key: &str) -> Result<(), StorageError> {
        self.state.borrow_mut().settings.remove(key);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::future::Future;
    use std::task::{Context, Poll, Waker};

    use uuid::Uuid;

    use super::*;

    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = std::pin::pin!(future);
        let mut context = Context::from_waker(Waker::noop());
        match future.as_mut().poll(&mut context) {
            Poll::Ready(value) => value,
            Poll::Pending => panic!("the memory storage does not wait"),
        }
    }

    fn counts(files: usize, trackpoint_chunks: usize, waypoint_chunks: usize) -> StorageCounts {
        StorageCounts {
            files,
            trackpoint_chunks,
            waypoint_chunks,
        }
    }

    #[test]
    fn test_empty_storage_has_nothing() {
        let storage = MemoryStorage::default();
        let data = block_on(storage.load()).unwrap();
        assert_eq!(data, StoredData::default());
        assert_eq!(storage.counts(), counts(0, 0, 0));
        assert!(block_on(storage.load_settings()).unwrap().is_empty());
    }

    #[test]
    fn test_commit_puts_and_deletes() {
        let storage = MemoryStorage::default();
        let (a, b) = (FileId::default(), FileId::default());
        let (t, w) = (Uuid::new_v4(), Uuid::new_v4());
        block_on(storage.commit(&Batch {
            put_files: vec![(a, vec![1]), (b, vec![2])],
            put_chunks: vec![
                (ChunkKey::trackpoints(t), vec![3]),
                (ChunkKey::waypoints(w), vec![4]),
            ],
            order: Some(vec![5]),
            expect_head: Revision(0),
            ..Default::default()
        }))
        .unwrap();
        assert_eq!(storage.counts(), counts(2, 1, 1));

        let mut data = block_on(storage.load()).unwrap();
        data.files.sort_by_key(|(_, bytes)| bytes.clone());
        assert_eq!(data.files, vec![(a, vec![1]), (b, vec![2])]);
        data.chunks.sort_by_key(|(_, bytes)| bytes.clone());
        assert_eq!(
            data.chunks,
            vec![
                (ChunkKey::trackpoints(t), vec![3]),
                (ChunkKey::waypoints(w), vec![4])
            ]
        );
        assert_eq!(data.order, Some(vec![5]));

        // a put replaces, a delete removes, what is not mentioned stays
        block_on(storage.commit(&Batch {
            put_files: vec![(a, vec![10])],
            delete_files: vec![b],
            delete_chunks: vec![ChunkKey::trackpoints(t)],
            expect_head: Revision(1),
            ..Default::default()
        }))
        .unwrap();
        assert_eq!(storage.counts(), counts(1, 0, 1));
        let data = block_on(storage.load()).unwrap();
        assert_eq!(data.files, vec![(a, vec![10])]);
        assert_eq!(data.order, Some(vec![5]));

        block_on(storage.commit(&Batch {
            delete_chunks: vec![ChunkKey::waypoints(w)],
            order: Some(vec![]),
            expect_head: Revision(2),
            ..Default::default()
        }))
        .unwrap();
        assert_eq!(storage.counts(), counts(1, 0, 0));
        assert_eq!(block_on(storage.load()).unwrap().order, Some(vec![]));
    }

    #[test]
    fn test_settings() {
        let storage = MemoryStorage::default();
        block_on(storage.put_setting("a", "1")).unwrap();
        block_on(storage.put_setting("b", "2")).unwrap();
        block_on(storage.put_setting("a", "3")).unwrap();
        let mut settings = block_on(storage.load_settings()).unwrap();
        settings.sort();
        assert_eq!(
            settings,
            vec![("a".into(), "3".into()), ("b".into(), "2".into())]
        );

        block_on(storage.delete_setting("a")).unwrap();
        // deleting what is not there is fine
        block_on(storage.delete_setting("missing")).unwrap();
        assert_eq!(
            block_on(storage.load_settings()).unwrap(),
            vec![("b".into(), "2".into())]
        );
    }

    #[test]
    fn test_settings_are_not_files() {
        let storage = MemoryStorage::default();
        block_on(storage.put_setting("a", "1")).unwrap();
        assert_eq!(block_on(storage.load()).unwrap(), StoredData::default());
    }

    fn batch(expect_head: u64, entry: u8) -> Batch {
        Batch {
            put_files: vec![(FileId::default(), vec![entry])],
            expect_head: Revision(expect_head),
            ..Default::default()
        }
    }

    #[test]
    fn test_every_commit_advances_the_head() {
        let storage = MemoryStorage::default();
        assert_eq!(block_on(storage.head()).unwrap(), Revision(0));
        assert_eq!(block_on(storage.load()).unwrap().head, Revision(0));
        assert_eq!(block_on(storage.commit(&batch(0, 1))), Ok(Revision(1)));
        assert_eq!(block_on(storage.commit(&batch(1, 2))), Ok(Revision(2)));
        assert_eq!(block_on(storage.head()).unwrap(), Revision(2));
        assert_eq!(block_on(storage.load()).unwrap().head, Revision(2));
    }

    #[test]
    fn test_a_commit_based_on_another_head_changes_nothing() {
        let storage = MemoryStorage::default();
        block_on(storage.commit(&batch(0, 1))).unwrap();
        block_on(storage.commit(&batch(1, 2))).unwrap();
        let before = block_on(storage.load()).unwrap();

        // behind, or ahead: the head is not the one it is based on
        for expect in [0, 1, 3] {
            let stale = Batch {
                delete_files: vec![before.files[0].0],
                order: Some(vec![9]),
                ..batch(expect, 3)
            };
            assert_eq!(
                block_on(storage.commit(&stale)),
                Err(CommitError::Stale { head: Revision(2) })
            );
        }
        let after = block_on(storage.load()).unwrap();
        assert_eq!(after.head, Revision(2));
        assert_eq!(after.files.len(), before.files.len());
        assert_eq!(after.order, before.order);
        // and it can be done again from the right head
        assert_eq!(block_on(storage.commit(&batch(2, 3))), Ok(Revision(3)));
    }
}
