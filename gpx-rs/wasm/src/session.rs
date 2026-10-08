//! The engine that every function talks to, and the way actions reach it.

use std::cell::RefCell;

use gpx_engine::{self as engine, Action, Command, Engine};
use wasm_bindgen::prelude::*;

use crate::convert::outcome_object;
use crate::persistence::schedule_save;
use crate::ts::Outcome;

thread_local! {
    pub(crate) static ENGINE: RefCell<Option<Engine>> = const { RefCell::new(None) };
}

/// What a call that does nothing returns, when the reason is in its arguments rather than in the
/// engine: the call is not made.
pub(crate) fn fail(message: impl AsRef<str>) -> Outcome {
    outcome_object(&engine::Outcome::default(), Some(message.as_ref()))
}

/// Runs an action and tells what it did, see `Outcome` in `ts`.
pub(crate) fn execute(action: Action) -> Outcome {
    let Some(outcome) = with_engine_mut(|engine| engine.execute(action)) else {
        return fail("the engine is not started");
    };
    if outcome.changed && (outcome.diff.is_some() || outcome.order_changed) {
        schedule_save();
    }
    let error = outcome.error.as_ref().map(ToString::to_string);
    outcome_object(&outcome, error.as_deref())
}

pub(crate) fn edit(command: Command) -> Outcome {
    execute(Action::Edit(command))
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
