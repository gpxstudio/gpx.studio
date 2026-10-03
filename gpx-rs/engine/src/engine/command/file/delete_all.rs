use crate::{Apply, CommandError, Selection, State};

#[derive(Debug)]
pub struct DeleteAll;

impl Apply for DeleteAll {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        if state.files.is_empty() {
            return Err(CommandError::NothingToDo);
        }
        state.files.clear();
        state.order.0.clear();
        *state.selection = Selection::Empty;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;

    use super::*;

    #[test]
    fn test_delete_all() {
        let mut fx = Fixture::default();
        assert_eq!(
            DeleteAll.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        crate::New { name: "a" }.apply(&mut fx.state()).unwrap();
        crate::New { name: "b" }.apply(&mut fx.state()).unwrap();
        assert!(DeleteAll.apply(&mut fx.state()).is_ok());
        assert!(fx.files.is_empty());
        assert!(fx.order.0.is_empty());
        assert!(matches!(fx.selection, Selection::Empty));
    }
}
