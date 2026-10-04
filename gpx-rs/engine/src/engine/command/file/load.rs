use crate::{Apply, CommandError, File, State, parse, produce};

#[derive(Debug)]
pub struct Load<'a> {
    pub data: &'a [u8],
    /// Name of the file when the data has none (typically the name of the file on disk, without
    /// its extension).
    pub name: &'a str,
}

impl Load<'_> {
    fn parse(self) -> Result<File, CommandError> {
        let mut file =
            parse(self.data).map_err(|err| CommandError::InvalidData(err.to_string()))?;
        if file.info.name.trim().is_empty() {
            file.info.name = self.name.to_owned();
        }
        Ok(file)
    }
}

impl Apply for Load<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        LoadFiles { files: vec![self] }.apply(state)
    }
}

/// Loads several files at once, as a single command (one undo step): the files are added at the
/// end of the list, in the given order, and the first one is selected.
///
/// The files that cannot be read are skipped, unless none of them can: then nothing is loaded
/// and the error is the one of the first file.
#[derive(Debug)]
pub struct LoadFiles<'a> {
    pub files: Vec<Load<'a>>,
}

impl Apply for LoadFiles<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let mut files = Vec::with_capacity(self.files.len());
        let mut first_error = None;
        for load in self.files {
            match load.parse() {
                Ok(file) => files.push(file),
                Err(error) => {
                    first_error.get_or_insert(error);
                }
            }
        }
        if files.is_empty() {
            return Err(first_error.unwrap_or(CommandError::NothingToDo));
        }
        produce(state, |_| files);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;

    use super::*;

    #[test]
    fn test_load() {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks.gpx").unwrap();
        assert!(
            Load {
                data: &data,
                name: "file",
            }
            .apply(&mut fx.state())
            .is_ok()
        );
        assert_eq!(fx.files.len(), 1);
        let file = fx.files.values().next().unwrap();
        assert!(!file.trk.is_empty());
        assert_eq!(fx.selected_files(), [file.id].into());
    }

    #[test]
    fn test_load_invalid_file_changes_nothing() {
        let mut fx = Fixture::default();
        crate::New { name: "keep" }.apply(&mut fx.state()).unwrap();
        let selected = fx.selected_files();

        let result = Load {
            data: b"<gpx><trk></gpx>",
            name: "file",
        }
        .apply(&mut fx.state());
        assert!(matches!(result, Err(CommandError::InvalidData(_))));
        assert_eq!(fx.files.len(), 1);
        assert_eq!(fx.order.0.len(), 1);
        assert_eq!(fx.selected_files(), selected);
    }

    fn load_with_name(data: &[u8]) -> String {
        let mut fx = Fixture::default();
        Load {
            data,
            name: "from disk",
        }
        .apply(&mut fx.state())
        .unwrap();
        fx.files.values().next().unwrap().info.name.clone()
    }

    #[test]
    fn test_load_keeps_the_name_of_the_file() {
        let data = br#"<gpx version="1.1"><metadata><name>in the file</name></metadata></gpx>"#;
        assert_eq!(load_with_name(data), "in the file");
    }

    #[test]
    fn test_load_without_name_uses_the_given_name() {
        let without = br#"<gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>"#;
        assert_eq!(load_with_name(without), "from disk");
        let empty = br#"<gpx version="1.1"><metadata><name>  </name></metadata></gpx>"#;
        assert_eq!(load_with_name(empty), "from disk");
    }

    fn gpx(name: &str) -> Vec<u8> {
        format!(r#"<gpx version="1.1"><metadata><name>{name}</name></metadata></gpx>"#).into_bytes()
    }

    fn load<'a>(data: &'a [u8], name: &'a str) -> Load<'a> {
        Load { data, name }
    }

    #[test]
    fn test_load_several_files() {
        let mut fx = Fixture::default();
        crate::New { name: "before" }
            .apply(&mut fx.state())
            .unwrap();
        let before = fx.order.0[0];
        let (a, b, c) = (gpx("a"), gpx("b"), gpx("c"));

        LoadFiles {
            files: vec![load(&a, "x"), load(&b, "x"), load(&c, "x")],
        }
        .apply(&mut fx.state())
        .unwrap();

        // added after the others, in the order they were given
        let names: Vec<_> = fx
            .order
            .0
            .iter()
            .map(|id| fx.files[id].info.name.clone())
            .collect();
        assert_eq!(names, ["before", "a", "b", "c"]);
        assert_eq!(fx.order.0[0], before);
        // the first one is selected
        assert_eq!(fx.selected_files(), [fx.order.0[1]].into());
    }

    #[test]
    fn test_load_several_files_skips_the_invalid_ones() {
        let mut fx = Fixture::default();
        let (a, c) = (gpx("a"), gpx("c"));
        LoadFiles {
            files: vec![load(&a, "x"), load(b"<gpx><trk></gpx>", "x"), load(&c, "x")],
        }
        .apply(&mut fx.state())
        .unwrap();
        let names: Vec<_> = fx
            .order
            .0
            .iter()
            .map(|id| fx.files[id].info.name.clone())
            .collect();
        assert_eq!(names, ["a", "c"]);
    }

    #[test]
    fn test_load_several_invalid_files_changes_nothing() {
        let mut fx = Fixture::default();
        crate::New { name: "keep" }.apply(&mut fx.state()).unwrap();
        let selected = fx.selected_files();

        let result = LoadFiles {
            files: vec![
                load(b"<gpx><trk></gpx>", "x"),
                load(b"<gpx><wpt></gpx>", "y"),
            ],
        }
        .apply(&mut fx.state());
        assert!(matches!(result, Err(CommandError::InvalidData(_))));
        assert_eq!(fx.files.len(), 1);
        assert_eq!(fx.order.0.len(), 1);
        assert_eq!(fx.selected_files(), selected);

        // nothing to load
        assert_eq!(
            LoadFiles { files: vec![] }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
    }

    #[test]
    fn test_each_file_without_name_gets_its_own_name() {
        let mut fx = Fixture::default();
        let unnamed = br#"<gpx version="1.1"><trk><trkseg></trkseg></trk></gpx>"#;
        LoadFiles {
            files: vec![load(unnamed, "first"), load(unnamed, "second")],
        }
        .apply(&mut fx.state())
        .unwrap();
        let names: Vec<_> = fx
            .order
            .0
            .iter()
            .map(|id| fx.files[id].info.name.clone())
            .collect();
        assert_eq!(names, ["first", "second"]);
    }
}
