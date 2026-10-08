//! Keeping the files and the settings in the browser.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use gpx_engine::{self as engine, Engine, Persister, Storage};
use js_sys::Object;
use wasm_bindgen::prelude::*;

use crate::convert::{outcome_object, set};
use crate::idb::IdbStorage;
use crate::session::*;
use crate::ts::StorageOpened;

// Storage
//
// The files are saved in IndexedDB after each change that touches them, without making the change
// wait: `schedule_save` starts a loop that writes what changed since the last write, until
// nothing has. The settings are opaque to the engine, the frontend keeps its own copy of them.

thread_local! {
    static STORAGE: RefCell<Option<Rc<IdbStorage>>> = const { RefCell::new(None) };
    static PERSISTER: RefCell<Option<Persister>> = const { RefCell::new(None) };
    static SAVING: Cell<bool> = const { Cell::new(false) };
    static DIRTY: Cell<bool> = const { Cell::new(false) };
    /// Resolve functions of the promises of `flush_storage`.
    static WAITERS: RefCell<Vec<js_sys::Function>> = const { RefCell::new(Vec::new()) };
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = error)]
    fn console_error(message: &str);
}

pub(crate) fn storage() -> Option<Rc<IdbStorage>> {
    STORAGE.with(|storage| storage.borrow().clone())
}

pub(crate) fn schedule_save() {
    if storage().is_none() {
        return;
    }
    DIRTY.set(true);
    if SAVING.replace(true) {
        // the running loop will go around again
        return;
    }
    wasm_bindgen_futures::spawn_local(async {
        while DIRTY.replace(false) {
            let Some(storage) = storage() else { break };
            let Some(snapshot) = with_engine(Engine::snapshot) else {
                break;
            };
            let mut persister = PERSISTER
                .with(|persister| persister.borrow_mut().take())
                .unwrap_or_default();
            let result = persister.save(&*storage, snapshot).await;
            PERSISTER.with(|slot| *slot.borrow_mut() = Some(persister));
            if let Err(error) = result {
                // what failed is written with the next change
                console_error(&error.to_string());
            }
        }
        SAVING.set(false);
        for resolve in WAITERS.with(|waiters| std::mem::take(&mut *waiters.borrow_mut())) {
            let _ = resolve.call0(&JsValue::UNDEFINED);
        }
    });
}

/// Opens the database `name` (it is created if it does not exist), puts the files that it holds
/// in the engine, which has to be empty, and returns the settings (JSON strings by key) and the
/// outcome of putting the files in. The changes of the files that follow are saved, unless some of
/// what is stored was written by a newer version of the app (`readOnly`): then nothing is, so that
/// the newer version finds its data again.
#[wasm_bindgen]
pub async fn open_storage(name: &str) -> Result<StorageOpened, JsValue> {
    let empty = with_engine(|e| e.snapshot().files.is_empty()).unwrap_or(false);
    if !empty {
        return Err(JsValue::from_str("the engine already has files"));
    }
    let storage = IdbStorage::open(name).await.map_err(to_js_error)?;
    let mut persister = Persister::default();
    let restored = persister.restore(&storage).await.map_err(to_js_error)?;
    let (read_only, unreadable) = (restored.read_only, restored.unreadable);
    let settings = storage.load_settings().await.map_err(to_js_error)?;

    let outcome = with_engine_mut(|engine| engine.restore(restored)).unwrap_or_default();
    PERSISTER.with(|slot| *slot.borrow_mut() = Some(persister));
    STORAGE.with(|slot| *slot.borrow_mut() = Some(Rc::new(storage)));

    let settings_object = Object::new();
    for (key, value) in settings {
        set(&settings_object, &key, value);
    }
    let opened = Object::new();
    set(&opened, "settings", settings_object);
    set(&opened, "outcome", outcome_object(&outcome, None));
    set(&opened, "readOnly", read_only);
    set(&opened, "unreadable", unreadable as f64);
    Ok(opened.unchecked_into())
}

pub(crate) fn to_js_error(error: engine::StorageError) -> JsValue {
    JsValue::from_str(&error.to_string())
}

/// Resolves when what was changed has been written to the storage.
#[wasm_bindgen]
pub async fn flush_storage() -> Result<(), JsValue> {
    if !SAVING.get() {
        return Ok(());
    }
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        WAITERS.with(|waiters| waiters.borrow_mut().push(resolve));
    });
    wasm_bindgen_futures::JsFuture::from(promise).await?;
    Ok(())
}

/// Saves a setting, `value` being its JSON.
#[wasm_bindgen]
pub fn set_setting(key: String, value: String) {
    if let Some(storage) = storage() {
        wasm_bindgen_futures::spawn_local(async move {
            if let Err(error) = storage.put_setting(&key, &value).await {
                console_error(&error.to_string());
            }
        });
    }
}

#[wasm_bindgen]
pub fn delete_setting(key: String) {
    if let Some(storage) = storage() {
        wasm_bindgen_futures::spawn_local(async move {
            if let Err(error) = storage.delete_setting(&key).await {
                console_error(&error.to_string());
            }
        });
    }
}
