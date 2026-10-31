use std::rc::Rc;

use crate::{File, Selection, State};

/// Pure producer: adds the files returned by `f` to the state and selects the first one.
pub fn produce<F>(state: &mut State, f: F)
where
    F: FnOnce(&State) -> Vec<File>,
{
    *state.selection = Selection::Empty;
    for file in f(state) {
        let file_id = file.id;
        state.files.insert(file_id, Rc::new(file));
        state.order.0.push(file_id);
        if matches!(*state.selection, Selection::Empty) {
            *state.selection = Selection::File {
                file_ids: [file_id].into(),
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::engine::command::fixture::Fixture;

    use super::*;

    fn named(name: &str) -> File {
        let mut file = File::default();
        file.info.name = name.to_string();
        file
    }

    #[test]
    fn test_produce_adds_orders_and_selects_first() {
        let mut fx = Fixture::default();
        let (a, b) = (named("a"), named("b"));
        let (id_a, id_b) = (a.id, b.id);
        produce(&mut fx.state(), |_| vec![a, b]);

        assert_eq!(fx.files.len(), 2);
        assert_eq!(fx.order.0, vec![id_a, id_b]);
        assert_eq!(fx.selected_files(), HashSet::from([id_a]));
    }

    #[test]
    fn test_produce_replaces_selection_and_keeps_order() {
        let mut fx = Fixture::default();
        let a = named("a");
        let id_a = a.id;
        produce(&mut fx.state(), |_| vec![a]);
        let b = named("b");
        let id_b = b.id;
        produce(&mut fx.state(), |_| vec![b]);

        assert_eq!(fx.order.0, vec![id_a, id_b]);
        assert_eq!(fx.selected_files(), HashSet::from([id_b]));
    }

    #[test]
    fn test_produce_nothing_clears_selection() {
        let mut fx = Fixture::default();
        produce(&mut fx.state(), |_| vec![named("a")]);
        produce(&mut fx.state(), |_| vec![]);
        assert!(matches!(fx.selection, Selection::Empty));
        assert_eq!(fx.files.len(), 1);
    }

    #[test]
    fn test_produce_sees_current_state() {
        let mut fx = Fixture::default();
        produce(&mut fx.state(), |_| vec![named("a")]);
        produce(&mut fx.state(), |state| {
            assert_eq!(state.files.len(), 1);
            vec![]
        });
    }
}
