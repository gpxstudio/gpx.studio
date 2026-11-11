use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
use std::rc::Rc;

use uuid::Uuid;

use super::codec::{
    DecodeError, decode_file, decode_order, decode_trackpoints, decode_waypoints, encode_file,
    encode_order, encode_trackpoints, encode_waypoints,
};
use crate::{
    Batch, ChunkKey, CommitError, File, FileId, Files, Revision, Storage, StorageError,
    TrackpointCategories, TrackpointChunk, WaypointChunk,
};

/// What there is to keep of the engine: the files of the current state, their order, and the
/// categories their trackpoints refer to. See [`crate::Engine::snapshot`].
#[derive(Debug, Default, Clone)]
pub struct Snapshot {
    pub files: Files,
    pub order: Vec<FileId>,
    pub categories: TrackpointCategories,
}

/// What was read from the storage, to start an engine with (see [`crate::Engine::restore`]).
#[derive(Debug, Default)]
pub struct Restored {
    pub files: Vec<Rc<File>>,
    pub order: Vec<FileId>,
    pub categories: TrackpointCategories,
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
    chunks: HashSet<ChunkKey>,
    order: Option<Vec<FileId>>,
    /// The head of the storage that all of this is the state of.
    head: Revision,
    /// Set by `restore`, see [`Restored::read_only`].
    read_only: bool,
}

/// Remembers whether something that was read comes from a newer version.
#[derive(Default)]
struct Newer(Cell<bool>);

impl Newer {
    fn read<T>(&self, result: Result<T, DecodeError>) -> Option<T> {
        match result {
            Ok(value) => Some(value),
            Err(error) => {
                self.0
                    .set(self.0.get() || matches!(error, DecodeError::UnknownVersion(_)));
                None
            }
        }
    }
}

/// What a save writes, and what is stored once it is written.
struct Plan {
    batch: Batch,
    snapshot: Snapshot,
    chunks: HashSet<ChunkKey>,
}

impl Persister {
    /// Reads the files of the storage. The persister then knows that they are saved.
    ///
    /// If some of what is stored was written by a newer version, nothing is read (`Newer`), and the
    /// persister does not save until it reads a storage that is not newer: the newer version
    /// needs its data.
    pub async fn restore<S: Storage>(&mut self, storage: &S) -> Result<Restored, StorageError> {
        let data = storage.load().await?;
        *self = Self::default();

        // what comes from a newer version is not corrupt: it must not be overwritten
        let newer = Newer::default();
        // the names of the chunks are added to the categories of the engine as they are read
        let categories: RefCell<TrackpointCategories> = Default::default();
        let stored_order: Option<Vec<FileId>> = data
            .order
            .as_deref()
            .and_then(|bytes| newer.read(decode_order(bytes)));

        let chunk_bytes: HashMap<ChunkKey, Vec<u8>> = data.chunks.into_iter().collect();
        // chunks are decoded once, whatever the number of files that use them
        let trackpoint_cache: RefCell<HashMap<Uuid, Option<Rc<TrackpointChunk>>>> =
            Default::default();
        let waypoint_cache: RefCell<HashMap<Uuid, Option<Rc<WaypointChunk>>>> = Default::default();
        let trackpoint_chunk = |id: &crate::TrackpointChunkId| {
            trackpoint_cache
                .borrow_mut()
                .entry(id.0)
                .or_insert_with(|| {
                    let bytes = chunk_bytes.get(&ChunkKey::trackpoints(id.0))?;
                    newer
                        .read(decode_trackpoints(
                            id.0,
                            bytes,
                            &mut categories.borrow_mut(),
                        ))
                        .map(Rc::new)
                })
                .clone()
        };
        let waypoint_chunk = |id: &crate::WaypointChunkId| {
            waypoint_cache
                .borrow_mut()
                .entry(id.0)
                .or_insert_with(|| {
                    let bytes = chunk_bytes.get(&ChunkKey::waypoints(id.0))?;
                    newer.read(decode_waypoints(id.0, bytes)).map(Rc::new)
                })
                .clone()
        };

        let mut files: HashMap<FileId, Rc<File>> = HashMap::new();
        for (id, bytes) in &data.files {
            self.stored_files.insert(*id);
            let file = newer
                .read(decode_file(bytes))
                .and_then(|record| record.build(*id, &trackpoint_chunk, &waypoint_chunk));
            // a file that cannot be read is left out, and dropped at the next save
            if let Some(file) = file {
                files.insert(*id, Rc::new(file));
            }
        }
        if newer.0.get() {
            // `*self` was reset: only what is needed to not write, and to know the storage
            self.read_only = true;
            self.head = data.head;
            return Err(StorageError::Newer);
        }

        let mut order: Vec<FileId> = stored_order
            .iter()
            .flatten()
            .filter(|id| files.contains_key(id))
            .copied()
            .collect();
        let ordered: HashSet<FileId> = order.iter().copied().collect();
        order.extend(files.keys().filter(|id| !ordered.contains(id)).copied());
        let restored = Restored {
            files: order.iter().map(|id| files[id].clone()).collect(),
            order,
            categories: categories.into_inner(),
        };

        self.files = files;
        self.chunks = chunk_bytes.into_keys().collect();
        self.order = stored_order;
        self.head = data.head;
        Ok(restored)
    }

    /// The revision of the storage that the persister knows.
    pub fn head(&self) -> Revision {
        self.head
    }

    /// Writes what changed since the last save. Nothing is written if nothing changed.
    ///
    /// Nothing is written while what is stored comes from a newer version (`Failed(Newer)`, see
    /// [`Persister::restore`]).
    ///
    /// The write only happens if nothing else was committed since the persister read or wrote
    /// last: otherwise it is refused (`Stale`), nothing is written, and the persister has to read
    /// the storage again ([`Persister::restore`]) before it can write.
    pub async fn save<S: Storage>(
        &mut self,
        storage: &S,
        snapshot: Snapshot,
    ) -> Result<(), CommitError> {
        if self.read_only {
            return Err(StorageError::Newer.into());
        }
        let mut plan = self.plan(snapshot);
        if plan.batch.is_empty() {
            self.files = plan.snapshot.files;
            return Ok(());
        }
        plan.batch.expect_head = self.head;
        self.head = storage.commit(&plan.batch).await?;

        self.stored_files = plan.snapshot.files.keys().copied().collect();
        self.files = plan.snapshot.files;
        self.chunks = plan.chunks;
        self.order = Some(plan.snapshot.order);
        Ok(())
    }

    /// Whether something else was committed to the storage since the persister read or wrote it
    /// last: what it knows of the storage is out of date, and it cannot write until it reads
    /// again ([`Persister::restore`]).
    pub async fn is_behind<S: Storage>(&self, storage: &S) -> Result<bool, StorageError> {
        Ok(storage.head().await? != self.head)
    }

    fn plan(&self, snapshot: Snapshot) -> Plan {
        let mut batch = Batch::default();
        // the chunks that the files use, which the storage has afterwards
        let mut chunks = HashSet::new();

        for (id, file) in &snapshot.files {
            let changed = self
                .files
                .get(id)
                .is_none_or(|saved| !Rc::ptr_eq(saved, file));
            for chunk in file.segments().flat_map(|segment| segment.chunks()) {
                let key = ChunkKey::trackpoints(chunk.id.0);
                if chunks.insert(key) && changed && !self.chunks.contains(&key) {
                    batch
                        .put_chunks
                        .push((key, encode_trackpoints(chunk, &snapshot.categories)));
                }
            }
            for chunk in file.wpt.chunks() {
                let key = ChunkKey::waypoints(chunk.id.0);
                if chunks.insert(key) && changed && !self.chunks.contains(&key) {
                    batch.put_chunks.push((key, encode_waypoints(chunk)));
                }
            }
            if changed || !self.stored_files.contains(id) {
                batch.put_files.push((*id, encode_file(file)));
            }
        }

        batch.delete_files = self
            .stored_files
            .iter()
            .filter(|id| !snapshot.files.contains_key(id))
            .copied()
            .collect();
        batch.delete_chunks = self.chunks.difference(&chunks).copied().collect();
        if self.order.as_ref() != Some(&snapshot.order) {
            batch.order = Some(encode_order(&snapshot.order));
        }

        Plan {
            batch,
            snapshot,
            chunks,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::future::Future;
    use std::task::{Context, Poll, Waker};

    use crate::{
        Action, ChunkKind, Command, Engine, ExportOptions, Load, MemoryStorage, StoredData, parse,
        write,
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

        async fn head(&self) -> Result<Revision, StorageError> {
            self.inner.head().await
        }

        async fn commit(&self, batch: &Batch) -> Result<Revision, CommitError> {
            let revision = self.inner.commit(batch).await?;
            self.batches.borrow_mut().push(batch.clone());
            Ok(revision)
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
            assert!(batch.put_chunks.is_empty());
            assert!(batch.delete_chunks.is_empty());
            assert!(batch.order.is_none());
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
            assert_eq!(batch.puts(ChunkKind::Trackpoints), 1);
            assert_eq!(batch.deletes(ChunkKind::Trackpoints), 1);
            assert_eq!(batch.puts(ChunkKind::Waypoints), 0);
        }
        assert_eq!(storage.inner.counts(), counts);
        assert!(chunks_before >= 1);

        // a deleted file takes its chunks and its record away
        snapshot.files.remove(&id);
        snapshot.order.retain(|other| *other != id);
        block_on(persister.save(&storage, snapshot)).unwrap();
        let after = storage.inner.counts();
        assert_eq!(after.files, counts.files - 1);
        assert!(after.trackpoint_chunks < counts.trackpoint_chunks);
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
        assert_eq!(storage.inner.counts().trackpoint_chunks, chunks);

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
            put_files: vec![(broken, vec![super::super::codec::LATEST, 0xff, 0xff])],
            expect_head: persister.head(),
            ..Default::default()
        }))
        .unwrap();
        let mut persister = Persister::default();
        let restored = block_on(persister.restore(&storage)).unwrap();
        assert_eq!(restored.files.len(), FILES.len() - 1);
        assert!(restored.files.iter().all(|file| file.id != broken));

        let kept = Snapshot {
            files: restored.files.iter().map(|f| (f.id, f.clone())).collect(),
            order: restored.order,
            categories: restored.categories,
        };
        block_on(persister.save(&storage, kept)).unwrap();
        assert_eq!(storage.inner.counts().files, FILES.len() - 1);
    }

    /// A storage holding the files, with one blob replaced by `damage`.
    fn stored_with(damage: impl FnOnce(&Snapshot, &mut Batch)) -> (Recording, Snapshot) {
        let storage = Recording::default();
        let snapshot = snapshot_of(&FILES);
        block_on(Persister::default().save(&storage, snapshot.clone())).unwrap();
        let mut batch = Batch::default();
        damage(&snapshot, &mut batch);
        batch.expect_head = block_on(storage.inner.head()).unwrap();
        block_on(storage.inner.commit(&batch)).unwrap();
        storage.batches.borrow_mut().clear();
        (storage, snapshot)
    }

    fn from_the_future() -> Vec<u8> {
        vec![super::super::codec::LATEST + 1, 1, 2, 3]
    }

    #[test]
    fn test_what_a_newer_version_wrote_is_left_alone() {
        type Damage = (&'static str, fn(&Snapshot, &mut Batch));
        let damages: [Damage; 3] = [
            ("a file", |snapshot, batch| {
                batch.put_files.push((snapshot.order[0], from_the_future()));
            }),
            ("a chunk", |snapshot, batch| {
                let file = &snapshot.files[&snapshot.order[0]];
                let chunk = &file.trk[0].trkseg[0].chunks()[0];
                batch
                    .put_chunks
                    .push((ChunkKey::trackpoints(chunk.id.0), from_the_future()));
            }),
            ("the order", |_, batch| {
                batch.order = Some(from_the_future())
            }),
        ];
        for (what, damage) in damages {
            let (storage, snapshot) = stored_with(damage);
            let before = storage.inner.counts();
            let mut persister = Persister::default();
            let result = block_on(persister.restore(&storage));
            assert_eq!(result.unwrap_err(), StorageError::Newer, "{what}");

            // whatever is saved afterwards is refused: the newer version needs its data
            let mut changed = snapshot.clone();
            changed.order.clear();
            changed.files.clear();
            let result = block_on(persister.save(&storage, changed));
            assert_eq!(
                result,
                Err(CommitError::Failed(StorageError::Newer)),
                "{what}"
            );
            assert!(storage.batches.borrow().is_empty(), "{what}");
            assert_eq!(storage.inner.counts(), before, "{what}");
        }
    }

    #[test]
    fn test_restoring_again_forgets_that_the_storage_was_newer() {
        let (storage, _) = stored_with(|snapshot, batch| {
            batch.put_files.push((snapshot.order[0], from_the_future()));
        });
        let mut persister = Persister::default();
        assert!(block_on(persister.restore(&storage)).is_err());

        // the same persister, on a storage that is not newer
        let clean = Recording::default();
        block_on(persister.restore(&clean)).unwrap();
        block_on(persister.save(&clean, snapshot_of(&FILES))).unwrap();
        assert_eq!(clean.inner.counts().files, FILES.len());
    }

    /// Opens a storage as a tab does: the persister, and the state of the engine it gives.
    fn open(storage: &Recording) -> (Persister, Snapshot) {
        let mut persister = Persister::default();
        let restored = block_on(persister.restore(storage)).unwrap();
        let snapshot = Snapshot {
            files: restored.files.iter().map(|f| (f.id, f.clone())).collect(),
            order: restored.order,
            categories: restored.categories,
        };
        (persister, snapshot)
    }

    /// Adds a file that has just been read to the state of an engine.
    fn add_file(snapshot: &mut Snapshot, path: &str) -> FileId {
        let data = std::fs::read(path).unwrap();
        let file = parse(&data, &mut snapshot.categories).unwrap();
        let id = file.id;
        snapshot.order.push(id);
        snapshot.files.insert(id, Rc::new(file));
        id
    }

    #[test]
    fn test_files_saved_by_engines_with_other_categories_read_the_same() {
        // a second engine opens the storage, so its categories come from what it read, in the
        // order it read them; it adds a file that has names of its own
        let storage = Recording::default();
        let first = snapshot_of(&["data/with_surface.gpx", "data/with_highway.gpx"]);
        block_on(Persister::default().save(&storage, first.clone())).unwrap();

        let (mut persister, mut second) = open(&storage);
        let added = add_file(&mut second, "data/with_surface.gpx");
        block_on(persister.save(&storage, second.clone())).unwrap();

        // the first engine reads it all again, and every file means what it did for its engine
        let (_, reader) = open(&storage);
        assert_eq!(reader.files.len(), 3);
        for (id, file) in &reader.files {
            let (original, categories) = match first.files.get(id) {
                Some(original) => (original, &first.categories),
                None => (&second.files[id], &second.categories),
            };
            assert_eq!(gpx(file, &reader.categories), gpx(original, categories));
        }
        assert!(reader.files.contains_key(&added));
    }

    #[test]
    fn test_the_head_follows_the_commits_of_the_persister() {
        let storage = Recording::default();
        let mut persister = Persister::default();
        assert_eq!(persister.head(), Revision(0));

        let mut snapshot = snapshot_of(&FILES);
        block_on(persister.save(&storage, snapshot.clone())).unwrap();
        assert_eq!(persister.head(), Revision(1));
        assert_eq!(block_on(storage.head()).unwrap(), Revision(1));

        // nothing to write is no commit
        block_on(persister.save(&storage, snapshot.clone())).unwrap();
        assert_eq!(persister.head(), Revision(1));
        assert_eq!(storage.batches.borrow().len(), 1);

        let id = snapshot.order[0];
        let mut file = (*snapshot.files[&id]).clone();
        file.info.name = "renamed".into();
        snapshot.files.insert(id, Rc::new(file));
        block_on(persister.save(&storage, snapshot)).unwrap();
        assert_eq!(persister.head(), Revision(2));
        // a persister that opens the storage starts from its head
        assert_eq!(open(&storage).0.head(), Revision(2));
        assert_eq!(storage.batches.borrow()[1].expect_head, Revision(1));
    }

    #[test]
    fn test_a_tab_that_is_behind_cannot_write() {
        // two tabs open the same file; one edits a point, the other renames the file
        let storage = Recording::default();
        block_on(Persister::default().save(&storage, snapshot_of(&["data/simple.gpx"]))).unwrap();
        let ((mut a, mut snap_a), (mut b, mut snap_b)) = (open(&storage), open(&storage));
        let id = snap_a.order[0];

        let mut file = (*snap_a.files[&id]).clone();
        file.trk[0].trkseg[0].update(0, |p| p.ele += 100.0);
        snap_a.files.insert(id, Rc::new(file));
        block_on(a.save(&storage, snap_a.clone())).unwrap();
        let stored = block_on(storage.load()).unwrap();

        let mut file = (*snap_b.files[&id]).clone();
        file.info.name = "renamed by B".into();
        snap_b.files.insert(id, Rc::new(file));
        assert_eq!(
            block_on(b.save(&storage, snap_b)),
            Err(CommitError::Stale { head: Revision(2) })
        );
        // nothing was written, the file is still readable, and the persister did not move
        assert_eq!(block_on(storage.load()).unwrap(), stored);
        assert_eq!(b.head(), Revision(1));
        let (_, reader) = open(&storage);
        assert_eq!(reader.files.len(), 1);
        assert_eq!(reader.files[&id].info.name, snap_a.files[&id].info.name);
    }

    #[test]
    fn test_a_tab_that_is_behind_reads_the_storage_again_and_writes_again() {
        let storage = Recording::default();
        block_on(Persister::default().save(&storage, snapshot_of(&["data/simple.gpx"]))).unwrap();
        let ((mut a, mut snap_a), (mut b, snap_b)) = (open(&storage), open(&storage));
        let id = snap_a.order[0];
        assert!(!block_on(b.is_behind(&storage)).unwrap());

        let mut file = (*snap_a.files[&id]).clone();
        file.info.name = "renamed by A".into();
        snap_a.files.insert(id, Rc::new(file));
        block_on(a.save(&storage, snap_a)).unwrap();
        assert!(block_on(b.is_behind(&storage)).unwrap());
        assert!(!block_on(a.is_behind(&storage)).unwrap());

        let restored = block_on(b.restore(&storage)).unwrap();
        assert_eq!(restored.files[0].info.name, "renamed by A");
        assert!(!block_on(b.is_behind(&storage)).unwrap());
        let mut snapshot = snap_b;
        snapshot.files.insert(id, restored.files[0].clone());
        assert!(block_on(b.save(&storage, snapshot)).is_ok());
    }

    #[test]
    fn test_chunks_shared_by_files_still_are_after_the_names_are_read() {
        let storage = Recording::default();
        let mut snapshot = snapshot_of(&["data/with_surface.gpx"]);
        let original = snapshot.files[&snapshot.order[0]].clone();
        let mut copy = (*original).clone();
        copy.id = FileId::default();
        snapshot.order.push(copy.id);
        snapshot.files.insert(copy.id, Rc::new(copy));
        block_on(Persister::default().save(&storage, snapshot)).unwrap();

        let restored = block_on(Persister::default().restore(&storage)).unwrap();
        assert_eq!(restored.files.len(), 2);
        assert!(Rc::ptr_eq(
            &restored.files[0].trk[0].trkseg[0].chunks()[0],
            &restored.files[1].trk[0].trkseg[0].chunks()[0]
        ));
        assert!(!restored.categories.surface.names().is_empty());
    }

    #[test]
    fn test_nothing_but_the_files_and_the_order_is_stored() {
        let storage = Recording::default();
        block_on(Persister::default().save(&storage, snapshot_of(&FILES))).unwrap();
        // the categories are in the chunks: a storage with no more than these is complete
        let data = block_on(storage.load()).unwrap();
        assert_eq!(data.files.len(), FILES.len());
        assert!(data.order.is_some());
    }

    #[test]
    fn test_an_engine_starts_from_what_is_restored() {
        let storage = Recording::default();
        let mut engine = Engine::default();
        let load = |engine: &mut Engine, path: &str| {
            let data = std::fs::read(path).unwrap();
            engine
                .execute(Action::Edit(Command::Load(Load {
                    data: &data,
                    name: "file",
                })))
                .unwrap()
                .changed
        };
        for path in FILES {
            assert!(load(&mut engine, path));
        }
        let snapshot = engine.snapshot();
        assert_eq!(snapshot.files.len(), FILES.len());
        block_on(Persister::default().save(&storage, snapshot.clone())).unwrap();

        let restored = block_on(Persister::default().restore(&storage)).unwrap();
        let mut engine = Engine::default();
        let outcome = engine.restore(restored);
        assert_eq!(engine.snapshot().order, snapshot.order);
        assert_eq!(outcome.diff.unwrap().added.len(), FILES.len());
        assert!(outcome.order_changed);
        for id in &snapshot.order {
            assert!(engine.file_structure(id).is_some());
        }

        // the files that were restored are not undone
        assert!(!engine.can_undo());
        assert!(!engine.execute(Action::Undo).unwrap().changed);
        assert!(load(&mut engine, FILES[0]));
        assert!(engine.can_undo());
        assert!(engine.execute(Action::Undo).unwrap().changed);
        assert_eq!(engine.snapshot().files.len(), FILES.len());
        assert!(!engine.can_undo());
    }
}
