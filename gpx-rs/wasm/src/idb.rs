//! The storage of the engine in the browser: IndexedDB.
//!
//! Values are stored as `Uint8Array`s under string keys (the hyphenated UUIDs), in one object
//! store per kind of data. A batch is a single transaction, so that the stored files always are
//! ones that the engine had.

use gpx_engine::{Batch, ChunkKey, ChunkKind, FileId, Storage, StorageError, StoredData};
use idb::TransactionMode;
use idb::{Database, DatabaseEvent, Factory, ObjectStore, ObjectStoreParams, Query, Transaction};
use js_sys::Uint8Array;
use uuid::Uuid;
use wasm_bindgen::JsValue;

const FILES: &str = "files";
const TRACKPOINT_CHUNKS: &str = "trackpoint_chunks";
const WAYPOINT_CHUNKS: &str = "waypoint_chunks";
/// The order of the files and the categories of the trackpoints, under their own names.
const META: &str = "meta";
const SETTINGS: &str = "settings";
const STORES: [&str; 5] = [FILES, TRACKPOINT_CHUNKS, WAYPOINT_CHUNKS, META, SETTINGS];

const ORDER_KEY: &str = "order";
const CATEGORIES_KEY: &str = "categories";

pub struct IdbStorage {
    database: Database,
}

fn error(error: impl std::fmt::Display) -> StorageError {
    StorageError(error.to_string())
}

/// The object store of a kind of chunks.
fn chunk_store(kind: ChunkKind) -> &'static str {
    match kind {
        ChunkKind::Trackpoints => TRACKPOINT_CHUNKS,
        ChunkKind::Waypoints => WAYPOINT_CHUNKS,
    }
}

fn key(id: Uuid) -> JsValue {
    JsValue::from_str(&id.to_string())
}

fn bytes(value: &[u8]) -> JsValue {
    Uint8Array::from(value).into()
}

fn to_vec(value: &JsValue) -> Vec<u8> {
    Uint8Array::new(value).to_vec()
}

fn to_uuid(key: &JsValue) -> Result<Uuid, StorageError> {
    key.as_string()
        .and_then(|key| Uuid::parse_str(&key).ok())
        .ok_or_else(|| error("a key is not an id"))
}

impl IdbStorage {
    /// Opens the database, which is created if it does not exist.
    pub async fn open(name: &str) -> Result<Self, StorageError> {
        let factory = Factory::new().map_err(error)?;
        let mut request = factory.open(name, Some(1)).map_err(error)?;
        request.on_upgrade_needed(|event| {
            if let Ok(database) = event.database() {
                for store in STORES {
                    let _ = database.create_object_store(store, ObjectStoreParams::new());
                }
            }
        });
        let database = request.await.map_err(error)?;
        Ok(Self { database })
    }

    fn transaction(
        &self,
        stores: &[&str],
        mode: TransactionMode,
    ) -> Result<Transaction, StorageError> {
        self.database.transaction(stores, mode).map_err(error)
    }

    /// Everything stored in the object store, as `(key, bytes)`.
    async fn read_all(store: &ObjectStore) -> Result<Vec<(JsValue, Vec<u8>)>, StorageError> {
        let keys = store.get_all_keys(None, None).map_err(error)?;
        let values = store.get_all(None, None).map_err(error)?;
        let (keys, values) = (keys.await.map_err(error)?, values.await.map_err(error)?);
        Ok(keys.into_iter().zip(values.iter().map(to_vec)).collect())
    }

    async fn write(&self, transaction: &Transaction, batch: &Batch) -> Result<(), StorageError> {
        let files = transaction.object_store(FILES).map_err(error)?;
        let meta = transaction.object_store(META).map_err(error)?;

        // the requests are all made before waiting for them
        let mut puts = vec![];
        let mut deletes = vec![];
        for (ChunkKey { kind, id }, data) in &batch.put_chunks {
            let store = transaction
                .object_store(chunk_store(*kind))
                .map_err(error)?;
            puts.push(store.put(&bytes(data), Some(&key(*id))).map_err(error)?);
        }
        for (FileId(id), data) in &batch.put_files {
            puts.push(files.put(&bytes(data), Some(&key(*id))).map_err(error)?);
        }
        if let Some(order) = &batch.order {
            let value = bytes(order);
            puts.push(
                meta.put(&value, Some(&JsValue::from_str(ORDER_KEY)))
                    .map_err(error)?,
            );
        }
        if let Some(categories) = &batch.categories {
            let value = bytes(categories);
            puts.push(
                meta.put(&value, Some(&JsValue::from_str(CATEGORIES_KEY)))
                    .map_err(error)?,
            );
        }
        for FileId(id) in &batch.delete_files {
            deletes.push(files.delete(Query::Key(key(*id))).map_err(error)?);
        }
        for ChunkKey { kind, id } in &batch.delete_chunks {
            let store = transaction
                .object_store(chunk_store(*kind))
                .map_err(error)?;
            deletes.push(store.delete(Query::Key(key(*id))).map_err(error)?);
        }
        for put in puts {
            put.await.map_err(error)?;
        }
        for delete in deletes {
            delete.await.map_err(error)?;
        }
        Ok(())
    }
}

impl Storage for IdbStorage {
    async fn load(&self) -> Result<StoredData, StorageError> {
        let transaction = self.transaction(
            &[FILES, TRACKPOINT_CHUNKS, WAYPOINT_CHUNKS, META],
            TransactionMode::ReadOnly,
        )?;
        let store = |name| transaction.object_store(name).map_err(error);
        let files = Self::read_all(&store(FILES)?).await?;
        let trackpoint_chunks = Self::read_all(&store(TRACKPOINT_CHUNKS)?).await?;
        let waypoint_chunks = Self::read_all(&store(WAYPOINT_CHUNKS)?).await?;
        let meta = store(META)?;
        let order = meta
            .get(JsValue::from_str(ORDER_KEY))
            .map_err(error)?
            .await
            .map_err(error)?;
        let categories = meta
            .get(JsValue::from_str(CATEGORIES_KEY))
            .map_err(error)?
            .await
            .map_err(error)?;
        transaction.await.map_err(error)?;

        let ids = |records: Vec<(JsValue, Vec<u8>)>| -> Result<Vec<(Uuid, Vec<u8>)>, StorageError> {
            records
                .into_iter()
                .map(|(k, v)| Ok((to_uuid(&k)?, v)))
                .collect()
        };
        Ok(StoredData {
            files: ids(files)?
                .into_iter()
                .map(|(id, data)| (FileId(id), data))
                .collect(),
            chunks: ids(trackpoint_chunks)?
                .into_iter()
                .map(|(id, data)| (ChunkKey::trackpoints(id), data))
                .chain(
                    ids(waypoint_chunks)?
                        .into_iter()
                        .map(|(id, data)| (ChunkKey::waypoints(id), data)),
                )
                .collect(),
            order: order.as_ref().map(to_vec),
            categories: categories.as_ref().map(to_vec),
        })
    }

    async fn commit(&self, batch: &Batch) -> Result<(), StorageError> {
        let transaction = self.transaction(
            &[FILES, TRACKPOINT_CHUNKS, WAYPOINT_CHUNKS, META],
            TransactionMode::ReadWrite,
        )?;
        match self.write(&transaction, batch).await {
            Ok(()) => {
                transaction.commit().map_err(error)?.await.map_err(error)?;
                Ok(())
            }
            Err(err) => {
                // nothing of the batch is kept
                let _ = transaction.abort();
                Err(err)
            }
        }
    }

    async fn load_settings(&self) -> Result<Vec<(String, String)>, StorageError> {
        let transaction = self.transaction(&[SETTINGS], TransactionMode::ReadOnly)?;
        let store = transaction.object_store(SETTINGS).map_err(error)?;
        let keys = store.get_all_keys(None, None).map_err(error)?;
        let values = store.get_all(None, None).map_err(error)?;
        let (keys, values) = (keys.await.map_err(error)?, values.await.map_err(error)?);
        transaction.await.map_err(error)?;
        Ok(keys
            .into_iter()
            .zip(values)
            .filter_map(|(key, value)| Some((key.as_string()?, value.as_string()?)))
            .collect())
    }

    async fn put_setting(&self, key: &str, value: &str) -> Result<(), StorageError> {
        let transaction = self.transaction(&[SETTINGS], TransactionMode::ReadWrite)?;
        let store = transaction.object_store(SETTINGS).map_err(error)?;
        store
            .put(&JsValue::from_str(value), Some(&JsValue::from_str(key)))
            .map_err(error)?
            .await
            .map_err(error)?;
        transaction.commit().map_err(error)?.await.map_err(error)?;
        Ok(())
    }

    async fn delete_setting(&self, key: &str) -> Result<(), StorageError> {
        let transaction = self.transaction(&[SETTINGS], TransactionMode::ReadWrite)?;
        let store = transaction.object_store(SETTINGS).map_err(error)?;
        store
            .delete(Query::Key(JsValue::from_str(key)))
            .map_err(error)?
            .await
            .map_err(error)?;
        transaction.commit().map_err(error)?.await.map_err(error)?;
        Ok(())
    }
}
