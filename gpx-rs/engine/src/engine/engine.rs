// TODO license in every file

use std::collections::HashSet;

use crate::{
    Action, Apply, Command, FileId, FileOrder, Selection, Stack, State, StatisticsBuffer,
    StatisticsCache,
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

    /// Single entry point for every action coming from the frontend. Returns whether anything
    /// changed.
    pub fn execute(&mut self, action: Action) -> bool {
        let changed = match action {
            Action::Edit(command) => self.edit(command),
            Action::Undo => self.stack.undo().is_some(),
            Action::Redo => self.stack.redo().is_some(),
            Action::Select { file_ids } => {
                self.selection = Selection::File {
                    file_ids: file_ids.into_iter().collect(),
                };
                true
            }
            Action::AddSelect { file_ids } => {
                match &mut self.selection {
                    Selection::File { file_ids: ids } => ids.extend(file_ids),
                    selection => {
                        *selection = Selection::File {
                            file_ids: file_ids.into_iter().collect(),
                        }
                    }
                }
                true
            }
            Action::SelectAll => {
                self.selection = Selection::File {
                    file_ids: self.order.0.iter().copied().collect(),
                };
                true
            }
        };
        if changed {
            self.refresh();
        }
        changed
    }

    fn edit(&mut self, command: Command) -> bool {
        self.stack
            .create_and_push_next(|files| {
                let mut state = State {
                    files,
                    selection: &mut self.selection,
                    order: &mut self.order,
                };
                command.apply(&mut state).map_err(|err| err.to_string())
            })
            .is_some()
    }

    /// Brings everything derived from the files back in line with the current stack entry.
    fn refresh(&mut self) {
        let current = self.stack.current();
        self.statistics_cache.update(current);
        self.statistics_buffer
            .update(&self.statistics_cache.get(current, &self.selection));
    }
}

#[cfg(test)]
mod tests {
    use crate::{Load, Metadata, New, NewTrack, Style};

    use super::*;

    fn edit(engine: &mut Engine, command: Command) -> bool {
        engine.execute(Action::Edit(command))
    }

    fn new(engine: &mut Engine, name: &str) -> bool {
        edit(engine, Command::New(New { name }))
    }

    fn load(engine: &mut Engine, path: &str) -> bool {
        let data = std::fs::read(path).unwrap();
        edit(engine, Command::Load(Load { data: &data }))
    }

    fn selected(engine: &Engine) -> Vec<FileId> {
        match &engine.selection {
            Selection::File { file_ids } => file_ids.iter().copied().collect(),
            _ => vec![],
        }
    }

    #[test]
    fn test_load_file() {
        let mut engine = Engine::default();
        assert!(load(&mut engine, "data/simple.gpx"));
        assert_eq!(engine.statistics_buffer.total_distance.len(), 80);
    }

    #[test]
    fn test_new_file_has_no_statistics() {
        let mut engine = Engine::default();
        assert!(new(&mut engine, "empty"));
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
        assert!(new(&mut engine, "empty"));
        assert!(engine.statistics().total_distance.is_empty());
        assert_eq!(engine.stack.current().unwrap().len(), 2);

        // loading a file selects it again
        assert!(load(&mut engine, "data/simple.gpx"));
        assert_eq!(engine.statistics().total_distance.len(), n);
    }

    #[test]
    fn test_invalid_load_is_rejected() {
        let mut engine = Engine::default();
        assert!(!edit(
            &mut engine,
            Command::Load(Load {
                data: b"<gpx><trk></gpx>"
            })
        ));
        assert!(engine.stack.current().is_none());
        assert!(!engine.stack.can_undo());
        assert!(engine.order.0.is_empty());
    }

    #[test]
    fn test_not_implemented_command_is_rejected() {
        let mut engine = Engine::default();
        new(&mut engine, "file");
        assert!(!edit(&mut engine, Command::Reverse(crate::Reverse)));
        assert!(!engine.stack.can_redo());
        assert_eq!(engine.stack.current().unwrap().len(), 1);
    }

    #[test]
    fn test_metadata_renames_selected_file() {
        let mut engine = Engine::default();
        new(&mut engine, "before");
        assert!(edit(
            &mut engine,
            Command::Metadata(Metadata {
                name: "after",
                desc: "about",
            })
        ));
        let file = engine.stack.current().unwrap().values().next().unwrap();
        assert_eq!(file.info.name, "after");
        assert_eq!(file.info.desc.as_deref(), Some("about"));
    }

    #[test]
    fn test_metadata_without_selection_does_not_modify_files() {
        let mut engine = Engine::default();
        new(&mut engine, "file");
        engine.selection = Selection::Empty;
        edit(
            &mut engine,
            Command::Metadata(Metadata {
                name: "renamed",
                desc: "",
            }),
        );
        let file = engine.stack.current().unwrap().values().next().unwrap();
        assert_eq!(file.info.name, "file");
    }

    #[test]
    fn test_edit_changes_statistics_when_segments_change() {
        let mut engine = Engine::default();
        load(&mut engine, "data/simple.gpx");
        let before = engine
            .statistics_cache
            .get(engine.stack.current(), &engine.selection)[0] as *const _;
        edit(&mut engine, Command::NewTrack(NewTrack));
        edit(
            &mut engine,
            Command::Style(Style {
                color: Some("ff0000"),
                opacity: None,
                width: None,
            }),
        );
        // styling does not touch the segments: their statistics are reused
        let after = engine
            .statistics_cache
            .get(engine.stack.current(), &engine.selection)[0] as *const _;
        assert!(std::ptr::eq(before, after));
    }

    #[test]
    fn test_undo_redo_keep_selection_and_order_consistent() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        let a = selected(&engine)[0];
        new(&mut engine, "b");
        let b = selected(&engine)[0];
        assert_eq!(engine.order.0, vec![a, b]);

        assert!(engine.execute(Action::Undo));
        assert_eq!(engine.order.0, vec![a]);
        assert!(selected(&engine).is_empty());

        assert!(engine.execute(Action::Redo));
        assert_eq!(engine.order.0, vec![a, b]);

        assert!(engine.execute(Action::Undo));
        assert!(engine.execute(Action::Undo));
        assert!(engine.order.0.is_empty());
        assert!(!engine.execute(Action::Undo));
        assert!(engine.stack.current().is_none());
    }

    #[test]
    fn test_undo_updates_statistics() {
        let mut engine = Engine::default();
        load(&mut engine, "data/simple.gpx");
        assert!(!engine.statistics().total_distance.is_empty());
        engine.execute(Action::Undo);
        assert!(engine.statistics().total_distance.is_empty());
        engine.execute(Action::Redo);
        engine.execute(Action::SelectAll);
        assert_eq!(engine.statistics().total_distance.len(), 80);
    }

    #[test]
    fn test_selection_actions() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        let a = selected(&engine)[0];
        new(&mut engine, "b");
        let b = selected(&engine)[0];
        assert_eq!(selected(&engine), vec![b]);

        assert!(engine.execute(Action::Select { file_ids: vec![a] }));
        assert_eq!(selected(&engine), vec![a]);

        assert!(engine.execute(Action::AddSelect { file_ids: vec![b] }));
        assert_eq!(selected(&engine).len(), 2);

        engine.execute(Action::Select { file_ids: vec![] });
        assert!(engine.execute(Action::SelectAll));
        assert_eq!(selected(&engine).len(), 2);
    }

    #[test]
    fn test_selection_does_not_create_undo_steps() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        engine.execute(Action::SelectAll);
        engine.execute(Action::Undo);
        assert!(engine.stack.current().is_none());
    }
}
