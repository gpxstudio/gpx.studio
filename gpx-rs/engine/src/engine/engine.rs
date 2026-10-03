// TODO license in every file

use crate::{
    Command, FileOrder, Selection, Stack, State, StatisticsBuffer, StatisticsCache, create_file,
    load_file, update_metadata,
};

#[derive(Debug, Default)]
pub struct Engine {
    stack: Stack,
    selection: Selection,
    order: FileOrder,
    statistics_cache: StatisticsCache,
    statistics_buffer: StatisticsBuffer,
}

impl Engine {
    pub fn statistics(&self) -> &StatisticsBuffer {
        &self.statistics_buffer
    }

    // pub fn delete_file(&mut self, id: &[u8]) -> bool {
    //     self.event_loop(|entry| {
    //         if let Ok(id) = Uuid::from_slice(id) {
    //             let id = FileId(id);
    //             entry.remove(&id).is_some()
    //         } else {
    //             false
    //         }
    //     })
    // }

    /// Single entry point for every user action coming from the frontend.
    pub fn execute(&mut self, command: Command) -> bool {
        if let Some(diff) = self.stack.create_and_push_next(|files| {
            let mut state = State {
                files,
                selection: &mut self.selection,
                order: &mut self.order,
            };
            match command {
                Command::New { name } => create_file(&mut state, name),
                Command::Load { data } => load_file(&mut state, data),
                Command::Metadata { name, desc } => update_metadata(&mut state, name, desc),
                Command::Delete
                | Command::DeleteAll
                | Command::Duplicate
                | Command::Style { .. }
                | Command::NewTrack
                | Command::NewTrackSegment
                | Command::Reverse
                | Command::Append { .. }
                | Command::Replace { .. }
                | Command::NewWaypoint { .. }
                | Command::MoveWaypoint { .. }
                | Command::Crop { .. }
                | Command::Split { .. }
                | Command::Time
                | Command::Merge { .. }
                | Command::Extract
                | Command::Elevation { .. }
                | Command::Clean { .. }
                | Command::Undo
                | Command::Redo
                | Command::Select { .. }
                | Command::AddSelect { .. }
                | Command::SelectAll => todo!("command not implemented yet"),
            }
        }) {
            self.statistics_cache.update(self.stack.current());
            self.statistics_buffer.update(
                &self
                    .statistics_cache
                    .get(self.stack.current(), &self.selection),
            );
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{fs::File, io::Read};

    use super::*;

    #[test]
    fn test_load_file() {
        let mut engine = Engine::default();

        let mut f = File::open("data/simple.gpx").unwrap();
        let mut data = String::new();
        let _ = f.read_to_string(&mut data);

        engine.execute(Command::Load {
            data: data.as_bytes(),
        });

        assert_eq!(engine.statistics_buffer.total_distance.len(), 80);
    }

    fn load(engine: &mut Engine, path: &str) -> bool {
        let data = std::fs::read(path).unwrap();
        engine.execute(Command::Load { data: &data })
    }

    #[test]
    fn test_new_file_has_no_statistics() {
        let mut engine = Engine::default();
        assert!(engine.execute(Command::New { name: "empty" }));
        assert_eq!(engine.stack.current().unwrap().len(), 1);
        assert_eq!(engine.order.0.len(), 1);
        assert!(engine.statistics().total_distance.is_empty());
    }

    #[test]
    fn test_statistics_follow_selection() {
        let mut engine = Engine::default();
        assert!(load(&mut engine, "data/simple.gpx"));
        let n = engine.statistics().total_distance.len();
        assert!(n > 0);

        // a newly created (empty) file becomes the selection
        assert!(engine.execute(Command::New { name: "empty" }));
        assert!(engine.statistics().total_distance.is_empty());
        assert_eq!(engine.stack.current().unwrap().len(), 2);

        // loading a file selects it again
        assert!(load(&mut engine, "data/simple.gpx"));
        assert_eq!(engine.statistics().total_distance.len(), n);
    }

    #[test]
    fn test_invalid_load_is_rejected() {
        let mut engine = Engine::default();
        assert!(!engine.execute(Command::Load {
            data: b"<gpx><trk></gpx>"
        }));
        assert!(engine.stack.current().is_none());
        assert!(!engine.stack.can_undo());
        assert!(engine.order.0.is_empty());
    }

    #[test]
    fn test_metadata_renames_selected_file() {
        let mut engine = Engine::default();
        engine.execute(Command::New { name: "before" });
        assert!(engine.execute(Command::Metadata {
            name: "after",
            desc: "about",
        }));
        let state = engine.stack.current().unwrap();
        let file = state.values().next().unwrap();
        assert_eq!(file.info.name, "after");
        assert_eq!(file.info.desc.as_deref(), Some("about"));
        assert!(engine.stack.can_undo());
    }

    #[test]
    fn test_metadata_without_selection_does_not_modify_files() {
        let mut engine = Engine::default();
        engine.execute(Command::New { name: "file" });
        engine.selection = Selection::Empty;
        engine.execute(Command::Metadata {
            name: "renamed",
            desc: "",
        });
        let state = engine.stack.current().unwrap();
        assert_eq!(state.values().next().unwrap().info.name, "file");
    }
}
