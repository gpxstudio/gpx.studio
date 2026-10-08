use std::cell::RefCell;
use std::collections::HashMap;

use uuid::Uuid;

use crate::{Batch, FileId, Storage, StorageError, StoredData};

/// A storage that lives as long as the session. It is what an engine without a host storage uses,
/// and what the tests use.
#[derive(Debug, Default)]
pub struct MemoryStorage {
    state: RefCell<State>,
}

#[derive(Debug, Default)]
struct State {
    files: HashMap<FileId, Vec<u8>>,
    trackpoint_chunks: HashMap<Uuid, Vec<u8>>,
    waypoint_chunks: HashMap<Uuid, Vec<u8>>,
    order: Option<Vec<u8>>,
    categories: Option<Vec<u8>>,
    settings: HashMap<String, String>,
}

impl MemoryStorage {
    /// How many files and chunks (trackpoints, waypoints) are stored.
    pub fn counts(&self) -> (usize, usize, usize) {
        let state = self.state.borrow();
        (
            state.files.len(),
            state.trackpoint_chunks.len(),
            state.waypoint_chunks.len(),
        )
    }
}

impl Storage for MemoryStorage {
    async fn load(&self) -> Result<StoredData, StorageError> {
        let state = self.state.borrow();
        Ok(StoredData {
            files: state.files.iter().map(|(k, v)| (*k, v.clone())).collect(),
            trackpoint_chunks: state
                .trackpoint_chunks
                .iter()
                .map(|(k, v)| (*k, v.clone()))
                .collect(),
            waypoint_chunks: state
                .waypoint_chunks
                .iter()
                .map(|(k, v)| (*k, v.clone()))
                .collect(),
            order: state.order.clone(),
            categories: state.categories.clone(),
        })
    }

    async fn commit(&self, batch: &Batch) -> Result<(), StorageError> {
        let mut state = self.state.borrow_mut();
        state.files.extend(batch.put_files.iter().cloned());
        for id in &batch.delete_files {
            state.files.remove(id);
        }
        state
            .trackpoint_chunks
            .extend(batch.put_trackpoint_chunks.iter().cloned());
        for id in &batch.delete_trackpoint_chunks {
            state.trackpoint_chunks.remove(id);
        }
        state
            .waypoint_chunks
            .extend(batch.put_waypoint_chunks.iter().cloned());
        for id in &batch.delete_waypoint_chunks {
            state.waypoint_chunks.remove(id);
        }
        if let Some(order) = &batch.order {
            state.order = Some(order.clone());
        }
        if let Some(categories) = &batch.categories {
            state.categories = Some(categories.clone());
        }
        Ok(())
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
