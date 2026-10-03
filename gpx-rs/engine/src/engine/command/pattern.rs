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
