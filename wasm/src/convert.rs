//! Turning what the shared interface (`gpx_engine::api`) gives into JS objects and back.

use gpx_engine::api;
use serde::{Serialize, de::DeserializeOwned};
use wasm_bindgen::prelude::*;

use crate::ts::Outcome;

/// A plain JS object (absent fields are `undefined`) with what `value` holds.
pub(crate) fn to_js<T: Serialize + ?Sized>(value: &T) -> JsValue {
    value
        .serialize(&serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true))
        .expect("the data can be turned into a JS value")
}

/// What `value` holds, `None` if it is not what `T` is.
pub(crate) fn from_js<T: DeserializeOwned>(value: &JsValue) -> Option<T> {
    serde_wasm_bindgen::from_value(value.clone()).ok()
}

/// `undefined` when there is nothing.
pub(crate) fn optional_js<T: Serialize>(value: Option<T>) -> JsValue {
    value.as_ref().map_or(JsValue::UNDEFINED, to_js)
}

pub(crate) fn outcome_js(outcome: &api::Outcome) -> Outcome {
    to_js(outcome).unchecked_into()
}
