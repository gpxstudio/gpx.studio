use crate::{Apply, CommandError, State, parse, produce};

#[derive(Debug)]
pub struct Load<'a> {
    pub data: &'a [u8],
    /// Name of the file when the data has none (typically the name of the file on disk, without
    /// its extension).
    pub name: &'a str,
}

impl Apply for Load<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let mut file =
            parse(self.data).map_err(|err| CommandError::InvalidData(err.to_string()))?;
        if file.info.name.trim().is_empty() {
            file.info.name = self.name.to_owned();
        }
        produce(state, |_| vec![file]);
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
}
