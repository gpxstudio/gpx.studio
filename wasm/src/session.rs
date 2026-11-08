//! The engine that every function talks to, and the way commands reach it.

use std::cell::RefCell;

use gpx_engine::{Engine, api};
use wasm_bindgen::prelude::*;

use crate::convert::outcome_js;
use crate::persistence::schedule_save;
use crate::ts::Outcome;

thread_local! {
    pub(crate) static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
}

/// What a call that does nothing returns, when the reason is in its arguments rather than in the
/// engine: the call is not made.
pub(crate) fn fail(message: impl Into<String>) -> Outcome {
    outcome_js(&api::Outcome::failed(message))
}

/// Makes a call of the shared interface that edits the files or changes the selection, and tells
/// what it did, see `Outcome` in `ts`. What changed in the files is saved.
pub(crate) fn run(call: impl FnOnce(&mut Engine) -> api::Outcome) -> Outcome {
    let Some(outcome) = with_engine_mut(call) else {
        return fail("the engine is not started");
    };
    if outcome.saves {
        schedule_save();
    }
    outcome_js(&outcome)
}

#[wasm_bindgen]
pub fn start() {
    console_error_panic_hook::set_once();
    ENGINE.with(|engine| {
        *engine.borrow_mut() = Some(Engine::default());
    });
}

pub(crate) fn with_engine<T>(f: impl FnOnce(&Engine) -> T) -> Option<T> {
    ENGINE.with(|engine| engine.borrow().as_ref().map(f))
}

pub(crate) fn with_engine_mut<T>(f: impl FnOnce(&mut Engine) -> T) -> Option<T> {
    ENGINE.with(|engine| engine.borrow_mut().as_mut().map(f))
}
