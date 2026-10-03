use crate::{File, State, parse, produce, update_each_selected_file};

pub fn create_file(state: &mut State, name: &str) -> Result<(), String> {
    produce(state, |_| {
        let mut file = File::default();
        file.info.name = name.to_owned();
        vec![file]
    });
    Ok(())
}

pub fn load_file(state: &mut State, data: &[u8]) -> Result<(), String> {
    let file = parse(data).map_err(|err| err.to_string())?;
    produce(state, |_| vec![file]);
    Ok(())
}

pub fn update_metadata(state: &mut State, name: &str, desc: &str) -> Result<(), String> {
    update_each_selected_file(state, &mut |file| {
        let mut next = (*file).clone();
        next.info.name = name.to_owned();
        next.info.desc = Some(desc.to_owned());
        next
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, FileOrder, Selection, StackEntry};

    use super::*;

    #[derive(Default)]
    struct Fixture {
        files: StackEntry,
        selection: Selection,
        order: FileOrder,
    }

    impl Fixture {
        fn state(&mut self) -> State<'_> {
            State {
                files: &mut self.files,
                selection: &mut self.selection,
                order: &mut self.order,
            }
        }

        fn selected_ids(&self) -> HashSet<FileId> {
            match &self.selection {
                Selection::File { file_ids } => file_ids.clone(),
                _ => HashSet::new(),
            }
        }
    }

    #[test]
    fn test_create_file() {
        let mut fx = Fixture::default();
        assert!(create_file(&mut fx.state(), "new").is_ok());
        assert_eq!(fx.files.len(), 1);
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.info.name, "new");
        assert!(file.trk.is_empty());
        assert_eq!(fx.selected_ids(), HashSet::from([file.id]));
        assert_eq!(fx.order.0, vec![file.id]);
    }

    #[test]
    fn test_load_file() {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks.gpx").unwrap();
        assert!(load_file(&mut fx.state(), &data).is_ok());
        assert_eq!(fx.files.len(), 1);
        let file = fx.files.values().next().unwrap();
        assert!(!file.trk.is_empty());
        assert_eq!(fx.selected_ids(), HashSet::from([file.id]));
    }

    #[test]
    fn test_load_invalid_file_changes_nothing() {
        let mut fx = Fixture::default();
        assert!(create_file(&mut fx.state(), "keep").is_ok());
        let selected = fx.selected_ids();

        assert!(load_file(&mut fx.state(), b"<gpx><trk></gpx>").is_err());
        assert_eq!(fx.files.len(), 1);
        assert_eq!(fx.order.0.len(), 1);
        assert_eq!(fx.selected_ids(), selected);
    }

    #[test]
    fn test_update_metadata_applies_to_selected_file() {
        let mut fx = Fixture::default();
        create_file(&mut fx.state(), "first").unwrap();
        create_file(&mut fx.state(), "second").unwrap(); // now selected
        let selected = *fx.selected_ids().iter().next().unwrap();

        update_metadata(&mut fx.state(), "renamed", "description").unwrap();

        for (id, file) in fx.files.iter() {
            if *id == selected {
                assert_eq!(file.info.name, "renamed");
                assert_eq!(file.info.desc.as_deref(), Some("description"));
            } else {
                assert_eq!(file.info.name, "first");
                assert_eq!(file.info.desc, None);
            }
        }
    }
}
