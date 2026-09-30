use crate::state::StackEntry;

pub trait Action {
    fn apply(entry: &mut StackEntry) -> Result<(), &'static str>;
}
