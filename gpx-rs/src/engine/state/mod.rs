mod clipboard;
mod history;
mod order;
mod selection;

pub use clipboard::*;
pub use history::*;
pub use order::*;
pub use selection::*;

pub struct State<'a> {
    pub categories: &'a mut crate::TrackpointCategories,
    pub files: &'a mut Files,
    pub selection: &'a mut Selection,
    pub order: &'a mut FileOrder,
    pub clipboard: &'a mut Option<Clipboard>,
}
