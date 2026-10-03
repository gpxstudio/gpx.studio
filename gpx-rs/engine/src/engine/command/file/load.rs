use crate::{Apply, CommandError, State, parse, produce};

#[derive(Debug)]
pub struct Load<'a> {
    pub data: &'a [u8],
}

impl Apply for Load<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let file = parse(self.data).map_err(|err| CommandError::InvalidData(err.to_string()))?;
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
        assert!(Load { data: &data }.apply(&mut fx.state()).is_ok());
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
        }
        .apply(&mut fx.state());
        assert!(matches!(result, Err(CommandError::InvalidData(_))));
        assert_eq!(fx.files.len(), 1);
        assert_eq!(fx.order.0.len(), 1);
        assert_eq!(fx.selected_files(), selected);
    }
}
