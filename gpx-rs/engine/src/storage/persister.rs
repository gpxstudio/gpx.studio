use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

use uuid::Uuid;

use super::codec::{
    FileRecord, decode, decode_trackpoints, decode_waypoints, encode, encode_trackpoints,
    encode_waypoints,
};
use crate::{
    Batch, File, FileId, StackEntry, Storage, StorageError, TrackpointCategories, TrackpointChunk,
    WaypointChunk,
};

/// What there is to keep of the engine: the files of the current state, their order, and the
/// categories their trackpoints refer to. See [`crate::Engine::snapshot`].
#[derive(Debug, Default, Clone)]
pub struct Snapshot {
    pub files: StackEntry,
    pub order: Vec<FileId>,
    pub categories: TrackpointCategories,
}

/// What was read from the storage, to start an engine with (see [`crate::Engine::restore`]).
#[derive(Debug, Default)]
pub struct Restored {
    pub files: Vec<Rc<File>>,
    pub order: Vec<FileId>,
    pub categories: TrackpointCategories,
    /// The files that could not be read: they are dropped at the next save.
    pub unreadable: usize,
}

/// Works out what to write to a [`Storage`] so that it holds a [`Snapshot`], knowing what it
/// already holds.
///
/// A file whose `Rc` is the saved one has not changed, which is what makes a save cheap: only the
/// files that changed are looked at to find the chunks to write, and the others are only counted
/// to find the chunks that nothing uses anymore.
#[derive(Debug, Default)]
pub struct Persister {
    /// The files as they are saved.
    files: HashMap<FileId, Rc<File>>,
    /// The files that have a record, including the ones that could not be read.
    stored_files: HashSet<FileId>,
    trackpoint_chunks: HashSet<Uuid>,
    waypoint_chunks: HashSet<Uuid>,
    order: Option<Vec<FileId>>,
    categories: Option<TrackpointCategories>,
}

/// What a save writes, and what is stored once it is written.
struct Plan {
    batch: Batch,
    snapshot: Snapshot,
    trackpoint_chunks: HashSet<Uuid>,
    waypoint_chunks: HashSet<Uuid>,
}

impl Persister {
    /// Reads the files of the storage. The persister then knows that they are saved.
    pub async fn restore<S: Storage>(&mut self, storage: &S) -> Result<Restored, StorageError> {
        let data = storage.load().await?;
        *self = Self::default();

        let categories: Option<TrackpointCategories> = data.categories.as_deref().and_then(decode);
        let stored_order: Option<Vec<FileId>> = data.order.as_deref().and_then(decode);

        let trackpoint_bytes: HashMap<Uuid, Vec<u8>> = data.trackpoint_chunks.into_iter().collect();
        let waypoint_bytes: HashMap<Uuid, Vec<u8>> = data.waypoint_chunks.into_iter().collect();
        // chunks are decoded once, whatever the number of files that use them
        let trackpoint_cache: RefCell<HashMap<Uuid, Option<Rc<TrackpointChunk>>>> =
            Default::default();
        let waypoint_cache: RefCell<HashMap<Uuid, Option<Rc<WaypointChunk>>>> = Default::default();
        let trackpoint_chunk = |id: &crate::TrackpointChunkId| {
            trackpoint_cache
                .borrow_mut()
                .entry(id.0)
                .or_insert_with(|| {
                    let bytes = trackpoint_bytes.get(&id.0)?;
                    decode_trackpoints(id.0, bytes).map(Rc::new)
                })
                .clone()
        };
        let waypoint_chunk = |id: &crate::WaypointChunkId| {
            waypoint_cache
                .borrow_mut()
                .entry(id.0)
                .or_insert_with(|| {
                    let bytes = waypoint_bytes.get(&id.0)?;
                    decode_waypoints(id.0, bytes).map(Rc::new)
                })
                .clone()
        };

        let mut restored = Restored {
            categories: categories.clone().unwrap_or_default(),
            ..Default::default()
        };
        let mut files: HashMap<FileId, Rc<File>> = HashMap::new();
        for (id, bytes) in &data.files {
            self.stored_files.insert(*id);
            let file = decode::<FileRecord>(bytes)
                .and_then(|record| record.build(*id, &trackpoint_chunk, &waypoint_chunk));
            match file {
                Some(file) => {
                    files.insert(*id, Rc::new(file));
                }
                None => restored.unreadable += 1,
            }
        }

        restored.order = stored_order
            .iter()
            .flatten()
            .filter(|id| files.contains_key(id))
            .copied()
            .collect();
        let ordered: HashSet<FileId> = restored.order.iter().copied().collect();
        restored
            .order
            .extend(files.keys().filter(|id| !ordered.contains(id)).copied());
        restored.files = restored.order.iter().map(|id| files[id].clone()).collect();

        self.files = files;
        self.trackpoint_chunks = trackpoint_bytes.into_keys().collect();
        self.waypoint_chunks = waypoint_bytes.into_keys().collect();
        self.order = stored_order;
        self.categories = categories;
        Ok(restored)
    }

    /// Writes what changed since the last save. Nothing is written if nothing changed.
    pub async fn save<S: Storage>(
        &mut self,
        storage: &S,
        snapshot: Snapshot,
    ) -> Result<(), StorageError> {
        let plan = self.plan(snapshot);
        if plan.batch.is_empty() {
            self.files = plan.snapshot.files;
            return Ok(());
        }
        storage.commit(&plan.batch).await?;

        self.stored_files = plan.snapshot.files.keys().copied().collect();
        self.files = plan.snapshot.files;
        self.trackpoint_chunks = plan.trackpoint_chunks;
        self.waypoint_chunks = plan.waypoint_chunks;
        self.order = Some(plan.snapshot.order);
        self.categories = Some(plan.snapshot.categories);
        Ok(())
    }

    fn plan(&self, snapshot: Snapshot) -> Plan {
        let mut batch = Batch::default();
        // the chunks that the files use, which the storage has afterwards
        let mut trackpoint_chunks = HashSet::new();
        let mut waypoint_chunks = HashSet::new();

        for (id, file) in &snapshot.files {
            let changed = self
                .files
                .get(id)
                .is_none_or(|saved| !Rc::ptr_eq(saved, file));
            let segments = file.trk.iter().flat_map(|track| &track.trkseg);
            for chunk in segments.flat_map(|segment| segment.chunks()) {
                let new = trackpoint_chunks.insert(chunk.id.0);
                if changed && new && !self.trackpoint_chunks.contains(&chunk.id.0) {
                    batch
                        .put_trackpoint_chunks
                        .push((chunk.id.0, encode_trackpoints(chunk)));
                }
            }
            for chunk in file.wpt.chunks() {
                let new = waypoint_chunks.insert(chunk.id.0);
                if changed && new && !self.waypoint_chunks.contains(&chunk.id.0) {
                    batch
                        .put_waypoint_chunks
                        .push((chunk.id.0, encode_waypoints(chunk)));
                }
            }
            if changed || !self.stored_files.contains(id) {
                batch.put_files.push((*id, encode(&FileRecord::new(file))));
            }
        }

        batch.delete_files = self
            .stored_files
            .iter()
            .filter(|id| !snapshot.files.contains_key(id))
            .copied()
            .collect();
        batch.delete_trackpoint_chunks = self
            .trackpoint_chunks
            .difference(&trackpoint_chunks)
            .copied()
            .collect();
        batch.delete_waypoint_chunks = self
            .waypoint_chunks
            .difference(&waypoint_chunks)
            .copied()
            .collect();
        if self.order.as_ref() != Some(&snapshot.order) {
            batch.order = Some(encode(&snapshot.order));
        }
        if self.categories.as_ref() != Some(&snapshot.categories) {
            batch.categories = Some(encode(&snapshot.categories));
        }

        Plan {
            batch,
            snapshot,
            trackpoint_chunks,
            waypoint_chunks,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::future::Future;
    use std::task::{Context, Poll, Waker};

    use crate::{
        Action, Command, Engine, ExportOptions, Load, MemoryStorage, StoredData, parse, write,
    };

    use super::*;

    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = std::pin::pin!(future);
        let mut context = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(value) = future.as_mut().poll(&mut context) {
                return value;
            }
        }
    }

    /// A memory storage that remembers the batches it was given.
    #[derive(Default)]
    struct Recording {
        inner: MemoryStorage,
        batches: RefCell<Vec<Batch>>,
    }

    impl Storage for Recording {
        async fn load(&self) -> Result<StoredData, StorageError> {
            self.inner.load().await
        }

        async fn commit(&self, batch: &Batch) -> Result<(), StorageError> {
            self.batches.borrow_mut().push(batch.clone());
            self.inner.commit(batch).await
        }

        async fn load_settings(&self) -> Result<Vec<(String, String)>, StorageError> {
            self.inner.load_settings().await
        }

        async fn put_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
            self.inner.put_setting(key, value).await
        }

        async fn delete_setting(&self, key: &str) -> Result<(), StorageError> {
            self.inner.delete_setting(key).await
        }
    }

    fn snapshot_of(paths: &[&str]) -> Snapshot {
        let mut snapshot = Snapshot::default();
        for path in paths {
            let data = std::fs::read(path).unwrap();
            let file = parse(&data, &mut snapshot.categories).unwrap();
            snapshot.order.push(file.id);
            snapshot.files.insert(file.id, Rc::new(file));
        }
        snapshot
    }

    fn gpx(file: &File, categories: &TrackpointCategories) -> Vec<u8> {
        write(file, categories, ExportOptions::ALL)
    }

    const FILES: [&str; 3] = [
        "data/with_tracks_and_segments.gpx",
        "data/with_waypoint.gpx",
        "data/with_surface.gpx",
    ];

    #[test]
    fn test_saved_files_are_restored() {
        let storage = Recording::default();
        let snapshot = snapshot_of(&FILES);
        block_on(Persister::default().save(&storage, snapshot.clone())).unwrap();

        let mut persister = Persister::default();
        let restored = block_on(persister.restore(&storage)).unwrap();
        assert_eq!(restored.unreadable, 0);
        assert_eq!(restored.order, snapshot.order);
        assert_eq!(restored.categories, snapshot.categories);
        for file in &restored.files {
            let original = &snapshot.files[&file.id];
            assert_eq!(
                gpx(file, &restored.categories),
                gpx(original, &snapshot.categories)
            );
            // identities that the rest of the engine refers to are kept
            assert_eq!(file.trk[0].id, original.trk[0].id);
            assert_eq!(file.trk[0].trkseg[0].id, original.trk[0].trkseg[0].id);
            assert_eq!(
                file.trk[0].trkseg[0].chunks()[0].id,
                original.trk[0].trkseg[0].chunks()[0].id
            );
        }
        // what was just read is saved
        let again = Snapshot {
            files: restored.files.iter().map(|f| (f.id, f.clone())).collect(),
            order: restored.order,
            categories: restored.categories,
        };
        block_on(persister.save(&storage, again)).unwrap();
        assert_eq!(storage.batches.borrow().len(), 1);
    }

    #[test]
    fn test_nothing_is_written_when_nothing_changed() {
        let storage = Recording::default();
        let snapshot = snapshot_of(&FILES);
        let mut persister = Persister::default();
        block_on(persister.save(&storage, snapshot.clone())).unwrap();
        block_on(persister.save(&storage, snapshot)).unwrap();
        assert_eq!(storage.batches.borrow().len(), 1);
    }

    #[test]
    fn test_an_edit_writes_what_it_changed_only() {
        let storage = Recording::default();
        let mut snapshot = snapshot_of(&FILES);
        let mut persister = Persister::default();
        block_on(persister.save(&storage, snapshot.clone())).unwrap();
        let counts = storage.inner.counts();

        // renaming a file writes its record, not its chunks
        let id = snapshot.order[0];
        let mut file = (*snapshot.files[&id]).clone();
        file.info.name = "renamed".into();
        snapshot.files.insert(id, Rc::new(file));
        block_on(persister.save(&storage, snapshot.clone())).unwrap();
        {
            let batches = storage.batches.borrow();
            let batch = batches.last().unwrap();
            assert_eq!(batch.put_files.len(), 1);
            assert!(batch.put_trackpoint_chunks.is_empty());
            assert!(batch.put_waypoint_chunks.is_empty());
            assert!(batch.delete_trackpoint_chunks.is_empty());
            assert!(batch.order.is_none() && batch.categories.is_none());
        }
        assert_eq!(storage.inner.counts(), counts);

        // changing a trackpoint replaces the chunk that holds it only
        let mut file = (*snapshot.files[&id]).clone();
        let chunks_before = file
            .trk
            .iter()
            .flat_map(|t| &t.trkseg)
            .map(|s| s.chunks().len())
            .sum::<usize>();
        file.trk[0].trkseg[0].update(0, |point| point.ele += 1.0);
        snapshot.files.insert(id, Rc::new(file));
        block_on(persister.save(&storage, snapshot.clone())).unwrap();
        {
            let batches = storage.batches.borrow();
            let batch = batches.last().unwrap();
            assert_eq!(batch.put_files.len(), 1);
            assert_eq!(batch.put_trackpoint_chunks.len(), 1);
            assert_eq!(batch.delete_trackpoint_chunks.len(), 1);
        }
        assert_eq!(storage.inner.counts(), counts);
        assert!(chunks_before >= 1);

        // a deleted file takes its chunks and its record away
        snapshot.files.remove(&id);
        snapshot.order.retain(|other| *other != id);
        block_on(persister.save(&storage, snapshot)).unwrap();
        let (files, trackpoint_chunks, _) = storage.inner.counts();
        assert_eq!(files, counts.0 - 1);
        assert!(trackpoint_chunks < counts.1);
    }

    #[test]
    fn test_chunks_shared_by_files_are_stored_once_and_stay_shared() {
        let storage = Recording::default();
        let mut snapshot = snapshot_of(&["data/with_time.gpx"]);
        let original = snapshot.files[&snapshot.order[0]].clone();
        let mut copy = (*original).clone();
        copy.id = FileId::default();
        snapshot.order.push(copy.id);
        snapshot.files.insert(copy.id, Rc::new(copy));

        let mut persister = Persister::default();
        block_on(persister.save(&storage, snapshot)).unwrap();
        let chunks = original.trk[0].trkseg[0].chunks().len();
        assert_eq!(storage.inner.counts().1, chunks);

        let restored = block_on(Persister::default().restore(&storage)).unwrap();
        assert_eq!(restored.files.len(), 2);
        assert!(Rc::ptr_eq(
            &restored.files[0].trk[0].trkseg[0].chunks()[0],
            &restored.files[1].trk[0].trkseg[0].chunks()[0]
        ));
    }

    #[test]
    fn test_unreadable_files_are_skipped_and_dropped_at_the_next_save() {
        let storage = Recording::default();
        let snapshot = snapshot_of(&FILES);
        let mut persister = Persister::default();
        block_on(persister.save(&storage, snapshot.clone())).unwrap();

        // damage a record, and lose a chunk of another file
        let broken = snapshot.order[0];
        block_on(storage.inner.commit(&Batch {
            put_files: vec![(broken, vec![99, 1, 2])],
            ..Default::default()
        }))
        .unwrap();
        let mut persister = Persister::default();
        let restored = block_on(persister.restore(&storage)).unwrap();
        assert_eq!(restored.unreadable, 1);
        assert_eq!(restored.files.len(), FILES.len() - 1);
        assert!(restored.files.iter().all(|file| file.id != broken));

        let kept = Snapshot {
            files: restored.files.iter().map(|f| (f.id, f.clone())).collect(),
            order: restored.order,
            categories: restored.categories,
        };
        block_on(persister.save(&storage, kept)).unwrap();
        assert_eq!(storage.inner.counts().0, FILES.len() - 1);
    }

    #[test]
    fn test_an_engine_starts_from_what_is_restored() {
        let storage = Recording::default();
        let mut engine = Engine::default();
        for path in FILES {
            let data = std::fs::read(path).unwrap();
            assert!(engine.execute(Action::Edit(Command::Load(Load {
                data: &data,
                name: "file",
            }))));
        }
        let snapshot = engine.snapshot();
        assert_eq!(snapshot.files.len(), FILES.len());
        block_on(Persister::default().save(&storage, snapshot.clone())).unwrap();

        let restored = block_on(Persister::default().restore(&storage)).unwrap();
        let mut engine = Engine::default();
        engine.restore(restored);
        assert_eq!(engine.snapshot().order, snapshot.order);
        let diff = engine.last_diff().unwrap();
        assert_eq!(diff.added.len(), FILES.len());
        assert!(engine.order_changed());
        for id in &snapshot.order {
            assert!(engine.file_structure(id).is_some());
        }

        // the files that were restored are not undone
        assert!(!engine.can_undo());
        assert!(!engine.execute(Action::Undo));
        let data = std::fs::read(FILES[0]).unwrap();
        assert!(engine.execute(Action::Edit(Command::Load(Load {
            data: &data,
            name: "file",
        }))));
        assert!(engine.can_undo());
        assert!(engine.execute(Action::Undo));
        assert_eq!(engine.snapshot().files.len(), FILES.len());
        assert!(!engine.can_undo());
    }
}
