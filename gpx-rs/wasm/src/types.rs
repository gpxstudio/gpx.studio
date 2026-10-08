//! The enumerations that cross to JS, and their engine counterparts.

use gpx_engine as engine;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum MergeType {
    Connect,
    Group,
}

/// What a split cuts in two.
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum SplitType {
    Files,
    Tracks,
    Segments,
}

impl From<SplitType> for engine::SplitType {
    fn from(t: SplitType) -> Self {
        match t {
            SplitType::Files => Self::Files,
            SplitType::Tracks => Self::Tracks,
            SplitType::Segments => Self::Segments,
        }
    }
}

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum CleanType {
    Inside,
    Outside,
}

/// How a selection combines with the current one: `Replace` it, `Add` to it, or `Toggle` the
/// elements (the ones already selected are removed).
#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum SelectMode {
    Replace,
    Add,
    Toggle,
}

impl From<SelectMode> for engine::SelectMode {
    fn from(m: SelectMode) -> Self {
        match m {
            SelectMode::Replace => Self::Replace,
            SelectMode::Add => Self::Add,
            SelectMode::Toggle => Self::Toggle,
        }
    }
}

impl From<MergeType> for engine::MergeType {
    fn from(t: MergeType) -> Self {
        match t {
            MergeType::Connect => Self::Connect,
            MergeType::Group => Self::Group,
        }
    }
}

impl From<CleanType> for engine::CleanType {
    fn from(t: CleanType) -> Self {
        match t {
            CleanType::Inside => Self::Inside,
            CleanType::Outside => Self::Outside,
        }
    }
}
