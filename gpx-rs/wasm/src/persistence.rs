//! Keeping the files and the settings in the browser.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use gpx_engine::{self as engine, Engine, Persister, Storage};
use js_sys::Object;
use wasm_bindgen::prelude::*;

use crate::convert::{outcome_object, set};
use crate::idb::IdbStorage;
use crate::session::*;
use crate::ts::{Outcome, StorageOpened};

// Storage
//
// The files are saved in IndexedDB after each change that touches them, without making the change
// wait: `schedule_save` starts a loop that writes what changed since the last write, until
// nothing has. When another tab wrote in between, the write is refused (the storage has a newer
// head than this tab last saw): the tab reads the storage again and overwrites what it holds, see
// `sync_storage`. The settings are opaque to the engine, the frontend keeps its own copy of them.

thread_local! {
    static STORAGE: RefCell<Option<Rc<IdbStorage>>> = const { RefCell::new(None) };
    static PERSISTER: RefCell<Option<Persister>> = const { RefCell::new(None) };
    static SAVING: Cell<bool> = const { Cell::new(false) };
    static DIRTY: Cell<bool> = const { Cell::new(false) };
    /// Resolve functions of the promises of `flush_storage`.
    /// Called after the files were written, and when a write was refused because they were
    /// written by someone else since: see `open_storage`.
    static LISTENERS: RefCell<Option<(js_sys::Function, js_sys::Function)>> = const { RefCell::new(None) };
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
        let (mut saved, mut behind) = (false, false);
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
            match result {
                Ok(()) => saved = true,
                // nothing was written, so that the files of the other tab are not damaged: this
                // tab has to read them, which replaces what it did
                Err(engine::CommitError::Stale { .. }) => {
                    DIRTY.set(false);
                    behind = true;
                }
                // what failed is written with the next change
                Err(error) => console_error(&error.to_string()),
            }
        }
        SAVING.set(false);
        if saved {
            notify(|(saved, _)| saved);
        }
        if behind {
            notify(|(_, behind)| behind);
        }
        for resolve in WAITERS.with(|waiters| std::mem::take(&mut *waiters.borrow_mut())) {
            let _ = resolve.call0(&JsValue::UNDEFINED);
        }
    });
}

fn notify(pick: impl FnOnce(&(js_sys::Function, js_sys::Function)) -> &js_sys::Function) {
    let callback = LISTENERS.with(|l| l.borrow().as_ref().map(|l| pick(l).clone()));
    if let Some(callback) = callback {
        let _ = callback.call0(&JsValue::UNDEFINED);
    }
}

/// Opens the database `name` (it is created if it does not exist), puts the files that it holds
/// in the engine, which has to be empty, and returns the settings (JSON strings by key) and the
/// outcome of putting the files in. The changes of the files that follow are saved, unless some of
/// what is stored was written by a newer version of the app: then nothing is read, and the files
/// cannot be changed (the outcome has the `Outdated` error), so that the newer version finds its
/// data again.
///
/// `on_saved` is called after the files were written (to tell the other tabs), and `on_behind` when
/// a write was refused because another tab wrote since (call `sync_storage` then).
#[wasm_bindgen]
pub async fn open_storage(
    name: &str,
    on_saved: js_sys::Function,
    on_behind: js_sys::Function,
) -> Result<StorageOpened, JsValue> {
    let empty = with_engine(|e| e.snapshot().files.is_empty()).unwrap_or(false);
    if !empty {
        return Err(JsValue::from_str("the engine already has files"));
    }
    let storage = IdbStorage::open(name).await.map_err(to_js_error)?;
    let mut persister = Persister::default();
    let outcome = restore_engine(persister.restore(&storage).await).map_err(to_js_error)?;
    let settings = storage.load_settings().await.map_err(to_js_error)?;

    PERSISTER.with(|slot| *slot.borrow_mut() = Some(persister));
    STORAGE.with(|slot| *slot.borrow_mut() = Some(Rc::new(storage)));
    LISTENERS.with(|slot| *slot.borrow_mut() = Some((on_saved, on_behind)));

    let settings_object = Object::new();
    for (key, value) in settings {
        set(&settings_object, &key, value);
    }
    let opened = Object::new();
    set(&opened, "settings", settings_object);
    set(&opened, "outcome", outcome);
    Ok(opened.unchecked_into())
}

/// Overwrites the files of the engine with what was read, and tells what that did. If what is
/// stored comes from a newer version of the app, the files are left as they are and cannot be
/// changed anymore: the error of the outcome says so, as for the edits that are refused afterwards.
fn restore_engine(
    read: Result<engine::Restored, engine::StorageError>,
) -> Result<Outcome, engine::StorageError> {
    match read {
        Ok(restored) => Ok(match with_engine_mut(|engine| engine.restore(restored)) {
            Some(outcome) => outcome_object(&outcome, None),
            None => outcome_object(&engine::Outcome::default(), None),
        }),
        Err(engine::StorageError::Newer) => {
            with_engine_mut(Engine::mark_outdated);
            Ok(fail(engine::CommandError::Outdated.to_string()))
        }
        Err(error) => Err(error),
    }
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

/// If another tab wrote the files since this one last did, reads them again and overwrites the
/// files of the engine with them (what was changed here and not saved is lost, and the history
/// starts over). Returns what that changed, to apply like the outcome of any other call.
#[wasm_bindgen]
pub async fn sync_storage() -> Result<Outcome, JsValue> {
    // the writes are done first, and none starts before this is done
    while SAVING.get() {
        flush_storage().await?;
    }
    let (Some(storage), Some(mut persister)) = (
        storage(),
        PERSISTER.with(|persister| persister.borrow_mut().take()),
    ) else {
        return Ok(outcome_object(&engine::Outcome::default(), None));
    };
    SAVING.set(true);
    let result = async {
        if !persister.is_behind(&*storage).await? {
            return Ok(outcome_object(&engine::Outcome::default(), None));
        }
        let outcome = restore_engine(persister.restore(&*storage).await)?;
        DIRTY.set(false);
        Ok(outcome)
    }
    .await;
    PERSISTER.with(|slot| *slot.borrow_mut() = Some(persister));
    SAVING.set(false);
    for resolve in WAITERS.with(|waiters| std::mem::take(&mut *waiters.borrow_mut())) {
        let _ = resolve.call0(&JsValue::UNDEFINED);
    }
    if DIRTY.get() {
        // edited while reading, and nothing was overwritten
        schedule_save();
    }
    result.map_err(to_js_error)
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
