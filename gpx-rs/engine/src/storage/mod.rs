//! Keeping the files and the settings between sessions.
//!
//! The engine does not know where the data goes: the host (the browser, a desktop app...)
//! implements [`Storage`], and a [`Persister`] works out what to write after each change.
//!
//! The files are not stored as a whole. Their trackpoints and waypoints are stored in chunks (see
//! [`crate::Chunked`]) that are written once, under their identity, and a file is a small record
//! that lists the chunks it is made of. An edit only writes the new chunks and the records of the
//! files that changed; the chunks that nothing refers to anymore are deleted at the same time.

mod codec;
mod memory;
mod persister;

pub use memory::*;
pub use persister::*;

use uuid::Uuid;

use crate::FileId;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageError(pub String);

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "storage error: {}", self.0)
    }
}

impl std::error::Error for StorageError {}

/// Everything that is stored about the files, as opaque bytes (see the module documentation).
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct StoredData {
    /// The record of each file.
    pub files: Vec<(FileId, Vec<u8>)>,
    pub trackpoint_chunks: Vec<(Uuid, Vec<u8>)>,
    pub waypoint_chunks: Vec<(Uuid, Vec<u8>)>,
    /// The order of the files.
    pub order: Option<Vec<u8>>,
    /// The categories of the trackpoints, which their chunks refer to.
    pub categories: Option<Vec<u8>>,
}

/// A change of the stored data, to be applied all at once: a stored state is always one that the
/// engine had.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Batch {
    pub put_files: Vec<(FileId, Vec<u8>)>,
    pub delete_files: Vec<FileId>,
    pub put_trackpoint_chunks: Vec<(Uuid, Vec<u8>)>,
    pub delete_trackpoint_chunks: Vec<Uuid>,
    pub put_waypoint_chunks: Vec<(Uuid, Vec<u8>)>,
    pub delete_waypoint_chunks: Vec<Uuid>,
    pub order: Option<Vec<u8>>,
    pub categories: Option<Vec<u8>>,
}

impl Batch {
    pub fn is_empty(&self) -> bool {
        self == &Self::default()
    }
}

/// Where the data is kept. The implementation belongs to the host; [`MemoryStorage`] is one that
/// keeps nothing after the session.
///
/// The methods are async because storage often is (IndexedDB), the engine itself is not: it
/// changes its files at once and the changes are written afterwards, see [`Persister`].
#[allow(async_fn_in_trait)]
pub trait Storage {
    /// Reads the files.
    async fn load(&self) -> Result<StoredData, StorageError>;

    /// Applies a batch: either all of it is stored, or none.
    async fn commit(&self, batch: &Batch) -> Result<(), StorageError>;

    /// Reads the settings, as `(key, value)`. The engine does not look into them.
    async fn load_settings(&self) -> Result<Vec<(String, String)>, StorageError>;

    async fn put_setting(&self, key: &str, value: &str) -> Result<(), StorageError>;

    async fn delete_setting(&self, key: &str) -> Result<(), StorageError>;
}
