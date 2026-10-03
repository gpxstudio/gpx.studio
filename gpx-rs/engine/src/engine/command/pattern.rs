use std::{
    collections::{HashSet, hash_map::Entry},
    rc::Rc,
};

use crate::{File, FileId, Selection, State};

pub fn produce<F>(state: &mut State, f: F)
where
    F: FnOnce(&State) -> Vec<File>,
{
    *state.selection = Selection::Empty;
    for file in f(state).drain(..) {
        let file_id = file.id;
        state.files.insert(file_id, Rc::new(file));
        state.order.0.push(file_id);
        if matches!(*state.selection, Selection::Empty) {
            let mut file_ids: HashSet<FileId> = Default::default();
            file_ids.insert(file_id);
            *state.selection = Selection::File { file_ids };
        }
    }
}

pub fn update_each_selected_file<F>(state: &mut State, f: &mut F)
where
    F: FnMut(&File) -> File,
{
    if let Selection::File { file_ids } = state.selection {
        for file_id in file_ids.iter() {
            if let Entry::Occupied(mut e) = state.files.entry(*file_id) {
                let file = e.get();
                let updated = Rc::new(f(file.as_ref()));
                e.insert(updated);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::FileOrder;

    use super::*;

    fn named(name: &str) -> File {
        let mut file = File::default();
        file.info.name = name.to_string();
        file
    }

    struct Fixture {
        files: crate::StackEntry,
        selection: Selection,
        order: FileOrder,
    }

    impl Fixture {
        fn new() -> Self {
            Self {
                files: Default::default(),
                selection: Selection::Empty,
                order: FileOrder::default(),
            }
        }

        fn state(&mut self) -> State<'_> {
            State {
                files: &mut self.files,
                selection: &mut self.selection,
                order: &mut self.order,
            }
        }

        fn selected(&self) -> HashSet<FileId> {
            match &self.selection {
                Selection::File { file_ids } => file_ids.clone(),
                _ => HashSet::new(),
            }
        }
    }

    #[test]
    fn test_produce_adds_orders_and_selects_first() {
        let mut fx = Fixture::new();
        let (a, b) = (named("a"), named("b"));
        let (id_a, id_b) = (a.id, b.id);
        produce(&mut fx.state(), |_| vec![a, b]);

        assert_eq!(fx.files.len(), 2);
        assert_eq!(fx.order.0, vec![id_a, id_b]);
        assert_eq!(fx.selected(), HashSet::from([id_a]));
    }

    #[test]
    fn test_produce_replaces_selection_and_keeps_order() {
        let mut fx = Fixture::new();
        let a = named("a");
        let id_a = a.id;
        produce(&mut fx.state(), |_| vec![a]);
        let b = named("b");
        let id_b = b.id;
        produce(&mut fx.state(), |_| vec![b]);

        assert_eq!(fx.order.0, vec![id_a, id_b]);
        assert_eq!(fx.selected(), HashSet::from([id_b]));
    }

    #[test]
    fn test_produce_nothing_clears_selection() {
        let mut fx = Fixture::new();
        let a = named("a");
        produce(&mut fx.state(), |_| vec![a]);
        produce(&mut fx.state(), |_| vec![]);
        assert!(matches!(fx.selection, Selection::Empty));
        assert_eq!(fx.files.len(), 1);
    }

    #[test]
    fn test_produce_sees_current_state() {
        let mut fx = Fixture::new();
        let a = named("a");
        produce(&mut fx.state(), |_| vec![a]);
        produce(&mut fx.state(), |state| {
            assert_eq!(state.files.len(), 1);
            vec![]
        });
    }

    #[test]
    fn test_update_each_selected_file_only_touches_selection() {
        let mut fx = Fixture::new();
        let (a, b, c) = (named("a"), named("b"), named("c"));
        let ids = [a.id, b.id, c.id];
        for file in [a, b, c] {
            fx.files.insert(file.id, Rc::new(file));
        }
        let untouched = fx.files[&ids[2]].clone();
        fx.selection = Selection::File {
            file_ids: HashSet::from([ids[0], ids[1]]),
        };

        let mut calls = 0;
        update_each_selected_file(&mut fx.state(), &mut |file| {
            calls += 1;
            let mut next = file.clone();
            next.info.name.push('!');
            next
        });

        assert_eq!(calls, 2);
        assert_eq!(fx.files[&ids[0]].info.name, "a!");
        assert_eq!(fx.files[&ids[1]].info.name, "b!");
        assert!(Rc::ptr_eq(&fx.files[&ids[2]], &untouched));
    }

    #[test]
    fn test_update_each_selected_file_ignores_missing_and_other_selections() {
        let mut fx = Fixture::new();
        let a = named("a");
        let id = a.id;
        fx.files.insert(id, Rc::new(a));

        let mut calls = 0;
        let mut count = |file: &File| {
            calls += 1;
            file.clone()
        };
        fx.selection = Selection::File {
            file_ids: HashSet::from([FileId::default()]),
        };
        update_each_selected_file(&mut fx.state(), &mut count);
        fx.selection = Selection::Waypoints { file_id: id };
        update_each_selected_file(&mut fx.state(), &mut count);
        fx.selection = Selection::Empty;
        update_each_selected_file(&mut fx.state(), &mut count);
        assert_eq!(calls, 0);
    }
}
