mod order;
mod selection;
mod stack;

pub use order::*;
pub use selection::*;
pub use stack::*;

pub struct State<'a> {
    pub files: &'a mut StackEntry,
    pub selection: &'a mut Selection,
    pub order: &'a mut FileOrder,
}
