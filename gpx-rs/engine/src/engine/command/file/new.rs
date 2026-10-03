use crate::{Apply, CommandError, File, State, produce};

#[derive(Debug)]
pub struct New<'a> {
    pub name: &'a str,
}

impl Apply for New<'_> {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        produce(state, |_| {
            let mut file = File::default();
            file.info.name = self.name.to_owned();
            vec![file]
        });
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::engine::command::fixture::Fixture;

    use super::*;

    #[test]
    fn test_new() {
        let mut fx = Fixture::default();
        assert!(New { name: "new" }.apply(&mut fx.state()).is_ok());
        assert_eq!(fx.files.len(), 1);
        let file = fx.files.values().next().unwrap();
        assert_eq!(file.info.name, "new");
        assert!(file.trk.is_empty());
        assert_eq!(fx.selected_files(), [file.id].into());
        assert_eq!(fx.order.0, vec![file.id]);
    }
}
