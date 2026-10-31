//! Keeping the files and the settings in the browser.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use gpx_engine::{self as engine, Engine, Persister, Storage, api};
use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::convert::{outcome_js, to_js};
use crate::idb::IdbStorage;
use crate::session::*;
use crate::ts::{Outcome, StorageOpened};

// Storage
//
// The files are saved in IndexedDB after each change that touches them, without making the change
// wait: `schedule_save` starts a loop that writes what changed since the last write, until
// nothing has. When another tab wrote in between, the write is refused (the storage has a newer
// head than this tab last saw): the tab reads the storage again and overwrites what it holds, see
// `sync_storage`. When what is stored was written by a newer version of the app, the write is
// refused too, and the frontend is told, so that it makes the user reload the page. The settings are opaque to the engine, the frontend keeps its own copy of them.

thread_local! {
    static STORAGE: RefCell<Option<Rc<IdbStorage>>> = const { RefCell::new(None) };
    static PERSISTER: RefCell<Option<Persister>> = const { RefCell::new(None) };
    static SAVING: Cell<bool> = const { Cell::new(false) };
    static DIRTY: Cell<bool> = const { Cell::new(false) };
    /// Resolve functions of the promises of `flush_storage`.
    /// Called after the files were written, and when a write was refused because they were
    /// written by someone else since: see `open_storage`.
    static LISTENERS: RefCell<Option<Listeners>> = const { RefCell::new(None) };
    static WAITERS: RefCell<Vec<js_sys::Function>> = const { RefCell::new(Vec::new()) };
}

/// What the frontend is told: the files were written, a write was refused because another tab
/// wrote since, a write was refused because what is stored comes from a newer version.
struct Listeners {
    saved: js_sys::Function,
    behind: js_sys::Function,
    newer: js_sys::Function,
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
        let (mut saved, mut behind, mut newer) = (false, false, false);
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
                // nothing is written, so that the newer version finds its data again
                Err(engine::CommitError::Failed(engine::StorageError::Newer)) => {
                    DIRTY.set(false);
                    newer = true;
                }
                // what failed is written with the next change
                Err(error) => console_error(&error.to_string()),
            }
        }
        SAVING.set(false);
        if saved {
            notify(|listeners| &listeners.saved);
        }
        if behind {
            notify(|listeners| &listeners.behind);
        }
        if newer {
            notify(|listeners| &listeners.newer);
        }
        for resolve in WAITERS.with(|waiters| std::mem::take(&mut *waiters.borrow_mut())) {
            let _ = resolve.call0(&JsValue::UNDEFINED);
        }
    });
}

fn notify(pick: impl FnOnce(&Listeners) -> &js_sys::Function) {
    let callback = LISTENERS.with(|l| l.borrow().as_ref().map(|l| pick(l).clone()));
    if let Some(callback) = callback {
        let _ = callback.call0(&JsValue::UNDEFINED);
    }
}

/// Opens the database `name` (it is created if it does not exist), puts the files that it holds
/// in the engine, which has to be empty, and returns the settings (JSON strings by key) and the
/// outcome of putting the files in. The changes of the files that follow are saved, unless some of
/// what is stored was written by a newer version of the app: then nothing is read and nothing is
/// ever written, so that the newer version finds its data again.
///
/// `on_saved` is called after the files were written (to tell the other tabs), `on_behind` when
/// a write was refused because another tab wrote since (call `sync_storage` then), and `on_newer`
/// when what is stored comes from a newer version (now, or when it is read again): the page has to
/// be reloaded, the changes are not kept.
#[wasm_bindgen]
pub async fn open_storage(
    name: &str,
    on_saved: js_sys::Function,
    on_behind: js_sys::Function,
    on_newer: js_sys::Function,
) -> Result<StorageOpened, JsValue> {
    let empty = with_engine(|e| e.snapshot().files.is_empty()).unwrap_or(false);
    if !empty {
        return Err(JsValue::from_str("the engine already has files"));
    }
    let storage = IdbStorage::open(name).await.map_err(to_js_error)?;
    let mut persister = Persister::default();
    let outcome = restore_engine(persister.restore(&storage).await).map_err(to_js_error)?;
    let newer = outcome.is_none();
    let outcome = outcome.unwrap_or_else(api::Outcome::failed_none);
    let settings = storage.load_settings().await.map_err(to_js_error)?;

    PERSISTER.with(|slot| *slot.borrow_mut() = Some(persister));
    STORAGE.with(|slot| *slot.borrow_mut() = Some(Rc::new(storage)));
    LISTENERS.with(|slot| {
        *slot.borrow_mut() = Some(Listeners {
            saved: on_saved,
            behind: on_behind,
            newer: on_newer,
        })
    });
    if newer {
        notify(|listeners| &listeners.newer);
    }

    /// What opening the storage found, see `StorageOpened` in `ts`.
    #[derive(Serialize)]
    struct Opened {
        settings: std::collections::BTreeMap<String, String>,
        outcome: api::Outcome,
    }
    Ok(to_js(&Opened {
        settings: settings.into_iter().collect(),
        outcome,
    })
    .unchecked_into())
}

/// Overwrites the files of the engine with what was read, and tells what that did. If what is
/// stored comes from a newer version of the app, the files are left as they are and `None` is
/// returned: the persister does not write anymore (see `Persister::save`).
fn restore_engine(
    read: Result<engine::Restored, engine::StorageError>,
) -> Result<Option<api::Outcome>, engine::StorageError> {
    match read {
        Ok(restored) => Ok(Some(
            match with_engine_mut(|engine| engine.restore(restored)) {
                Some(outcome) => api::Outcome::new(&outcome, None),
                None => api::Outcome::failed_none(),
            },
        )),
        Err(engine::StorageError::Newer) => Ok(None),
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
        return Ok(outcome_js(&api::Outcome::failed_none()));
    };
    SAVING.set(true);
    let result = async {
        if !persister.is_behind(&*storage).await? {
            return Ok(outcome_js(&api::Outcome::failed_none()));
        }
        let outcome = restore_engine(persister.restore(&*storage).await)?;
        DIRTY.set(false);
        if outcome.is_none() {
            notify(|listeners| &listeners.newer);
        }
        Ok(outcome_js(
            &outcome.unwrap_or_else(api::Outcome::failed_none),
        ))
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
