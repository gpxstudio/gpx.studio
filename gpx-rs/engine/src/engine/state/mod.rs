mod clipboard;
mod order;
mod selection;
mod stack;

pub use clipboard::*;
pub use order::*;
pub use selection::*;
pub use stack::*;

pub struct State<'a> {
    pub categories: &'a mut crate::TrackpointCategories,
    pub files: &'a mut StackEntry,
    pub selection: &'a mut Selection,
    pub order: &'a mut FileOrder,
    pub clipboard: &'a mut Option<Clipboard>,
}
