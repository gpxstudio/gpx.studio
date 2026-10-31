//! The storage of the engine on the file system: what the engine holds is kept between sessions,
//! in a directory of the app (see `gpx_engine::Storage`).
//!
//! ```text
//! head                 the revision of the last commit
//! order                the order of the files
//! files/<id>           the record of each file
//! trackpoints/<id>     the chunks of trackpoints
//! waypoints/<id>       the chunks of waypoints
//! settings.json        the settings of the frontend
//! ```
//!
//! A commit writes the chunks, the records and the order first, then the head, then deletes what
//! is not used anymore: the head moves once all of the new data is there, and nothing that the old
//! data refers to is gone before that.

use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use gpx_engine::{
    Batch, ChunkKey, ChunkKind, CommitError, FileId, Revision, Storage, StorageError, StoredData,
};
use uuid::Uuid;

pub struct FileStorage {
    root: PathBuf,
    settings: Mutex<BTreeMap<String, String>>,
}

fn failed(error: impl std::fmt::Display) -> StorageError {
    StorageError::Failed(error.to_string())
}

/// Writes a file as a whole or not at all.
pub fn write_atomically(path: &Path, bytes: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes)?;
    fs::rename(&temporary, path)
}

fn read_optional(path: &Path) -> io::Result<Option<Vec<u8>>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

fn remove(path: &Path) -> io::Result<()> {
    match fs::remove_file(path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

impl FileStorage {
    /// Opens the storage in `root`, which is created if it does not exist.
    pub fn open(root: impl Into<PathBuf>) -> Result<Self, StorageError> {
        let root = root.into();
        fs::create_dir_all(&root).map_err(failed)?;
        let settings = match read_optional(&root.join("settings.json")).map_err(failed)? {
            Some(bytes) => serde_json::from_slice(&bytes).map_err(failed)?,
            None => BTreeMap::new(),
        };
        Ok(Self {
            root,
            settings: Mutex::new(settings),
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn settings(&self) -> BTreeMap<String, String> {
        self.settings.lock().unwrap().clone()
    }

    fn chunk_path(&self, key: &ChunkKey) -> PathBuf {
        let directory = match key.kind {
            ChunkKind::Trackpoints => "trackpoints",
            ChunkKind::Waypoints => "waypoints",
        };
        self.root.join(directory).join(key.id.to_string())
    }

    fn file_path(&self, id: &FileId) -> PathBuf {
        self.root.join("files").join(id.0.to_string())
    }

    /// The ids and contents of the files of a directory, named by UUIDs.
    fn read_directory(&self, name: &str) -> Result<Vec<(Uuid, Vec<u8>)>, StorageError> {
        let directory = self.root.join(name);
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(vec![]),
            Err(error) => return Err(failed(error)),
        };
        let mut items = vec![];
        for entry in entries {
            let path = entry.map_err(failed)?.path();
            let Some(id) = path
                .file_name()
                .and_then(|name| name.to_str())
                .and_then(|name| Uuid::parse_str(name).ok())
            else {
                // temporary files of a write that did not finish
                continue;
            };
            items.push((id, fs::read(&path).map_err(failed)?));
        }
        Ok(items)
    }

    fn save_settings(&self, settings: &BTreeMap<String, String>) -> Result<(), StorageError> {
        let json = serde_json::to_vec(settings).map_err(failed)?;
        write_atomically(&self.root.join("settings.json"), &json).map_err(failed)
    }

    fn read_head(&self) -> Result<Revision, StorageError> {
        match read_optional(&self.root.join("head")).map_err(failed)? {
            Some(bytes) => String::from_utf8_lossy(&bytes)
                .trim()
                .parse()
                .map(Revision)
                .map_err(failed),
            None => Ok(Revision::default()),
        }
    }

    fn write_batch(&self, batch: &Batch, head: Revision) -> io::Result<()> {
        for (key, bytes) in &batch.put_chunks {
            write_atomically(&self.chunk_path(key), bytes)?;
        }
        for (id, bytes) in &batch.put_files {
            write_atomically(&self.file_path(id), bytes)?;
        }
        if let Some(order) = &batch.order {
            write_atomically(&self.root.join("order"), order)?;
        }
        write_atomically(&self.root.join("head"), head.0.to_string().as_bytes())?;
        for id in &batch.delete_files {
            remove(&self.file_path(id))?;
        }
        for key in &batch.delete_chunks {
            remove(&self.chunk_path(key))?;
        }
        Ok(())
    }
}

impl Storage for FileStorage {
    async fn load(&self) -> Result<StoredData, StorageError> {
        let chunks = |kind: ChunkKind, name: &str| -> Result<Vec<_>, StorageError> {
            Ok(self
                .read_directory(name)?
                .into_iter()
                .map(|(id, bytes)| (ChunkKey { kind, id }, bytes))
                .collect())
        };
        let mut all_chunks = chunks(ChunkKind::Trackpoints, "trackpoints")?;
        all_chunks.extend(chunks(ChunkKind::Waypoints, "waypoints")?);
        Ok(StoredData {
            files: self
                .read_directory("files")?
                .into_iter()
                .map(|(id, bytes)| (FileId(id), bytes))
                .collect(),
            chunks: all_chunks,
            order: read_optional(&self.root.join("order")).map_err(failed)?,
            head: self.read_head()?,
        })
    }

    async fn head(&self) -> Result<Revision, StorageError> {
        self.read_head()
    }

    async fn commit(&self, batch: &Batch) -> Result<Revision, CommitError> {
        let head = self.read_head()?;
        if head != batch.expect_head {
            return Err(CommitError::Stale { head });
        }
        let next = head.next();
        self.write_batch(batch, next)
            .map_err(|error| CommitError::Failed(failed(error)))?;
        Ok(next)
    }

    async fn load_settings(&self) -> Result<Vec<(String, String)>, StorageError> {
        Ok(self
            .settings
            .lock()
            .unwrap()
            .iter()
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect())
    }

    async fn put_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        let mut settings = self.settings.lock().unwrap();
        settings.insert(key.to_owned(), value.to_owned());
        self.save_settings(&settings)
    }

    async fn delete_setting(&self, key: &str) -> Result<(), StorageError> {
        let mut settings = self.settings.lock().unwrap();
        if settings.remove(key).is_some() {
            self.save_settings(&settings)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::Engine;
    use gpx_engine::{Action, Command, Load, LoadFiles, Persister};

    use super::*;

    fn directory() -> PathBuf {
        std::env::temp_dir().join(format!("gpx-studio-store-{}", Uuid::new_v4()))
    }

    fn engine_with_a_file() -> Engine {
        let mut engine = Engine::default();
        let data = std::fs::read("../gpx-rs/data/simple.gpx").unwrap();
        engine
            .execute(Action::Edit(Command::LoadFiles(LoadFiles {
                files: vec![Load {
                    data: &data,
                    name: "simple",
                }],
            })))
            .unwrap();
        engine
    }

    #[test]
    fn keeps_the_files_and_the_settings_between_sessions() {
        let root = directory();
        let engine = engine_with_a_file();
        let order = engine.order().to_vec();

        let storage = FileStorage::open(&root).unwrap();
        pollster::block_on(Persister::default().save(&storage, engine.snapshot())).unwrap();
        pollster::block_on(storage.put_setting("units", "\"metric\"")).unwrap();

        // another session
        let storage = FileStorage::open(&root).unwrap();
        let restored = pollster::block_on(Persister::default().restore(&storage)).unwrap();
        let mut other = Engine::default();
        other.restore(restored);
        assert_eq!(other.order(), order);
        assert_eq!(
            other.file_statistics(&order[0]).unwrap().total_distance,
            engine.file_statistics(&order[0]).unwrap().total_distance
        );
        assert_eq!(storage.settings()["units"], "\"metric\"");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_commit_that_is_not_based_on_the_head() {
        let root = directory();
        let storage = FileStorage::open(&root).unwrap();
        let batch = Batch {
            order: Some(vec![]),
            ..Default::default()
        };
        assert_eq!(pollster::block_on(storage.commit(&batch)), Ok(Revision(1)));
        assert_eq!(
            pollster::block_on(storage.commit(&batch)),
            Err(CommitError::Stale { head: Revision(1) })
        );
        fs::remove_dir_all(root).unwrap();
    }
}
