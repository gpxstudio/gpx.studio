// TODO license in every file

use crate::{
    Action, Apply, Command, CoordinatesCache, Diff, FileId, FileOrder, FileStructure,
    FileStructureCache, GlobalStatistics, SelectMode, Selection, Stack, State, StatisticsBuffer,
    StatisticsCache, TrackSegmentId,
};

#[derive(Debug, Default)]
pub struct Engine {
    stack: Stack,
    selection: Selection,
    order: FileOrder,
    statistics_cache: StatisticsCache,
    coordinates_cache: CoordinatesCache,
    structure_cache: FileStructureCache,
    diff: Option<Diff>,
    order_changed: bool,
    selection_changed: bool,
    statistics_buffer: StatisticsBuffer,
}

impl Engine {
    pub fn statistics(&self) -> &StatisticsBuffer {
        &self.statistics_buffer
    }

    /// Files in display order.
    pub fn order(&self) -> &[FileId] {
        &self.order.0
    }

    /// Name, tracks, segments and waypoints (with their ids) of a file.
    pub fn file_structure(&self, id: &FileId) -> Option<&FileStructure> {
        self.structure_cache.get(id)
    }

    /// Global statistics (distance, time, elevation, bounds...) of a file.
    pub fn file_statistics(&self, id: &FileId) -> Option<GlobalStatistics> {
        let file = self.stack.current()?.get(id)?;
        Some(self.statistics_cache.file_global(file))
    }

    /// Which files the last action added, removed or modified.
    pub fn last_diff(&self) -> Option<&Diff> {
        self.diff.as_ref()
    }

    /// Whether the last action changed the order of the files.
    pub fn order_changed(&self) -> bool {
        self.order_changed
    }

    /// Currently selected elements.
    pub fn selection(&self) -> &Selection {
        &self.selection
    }

    /// Whether the last action changed the selection.
    pub fn selection_changed(&self) -> bool {
        self.selection_changed
    }

    /// Coordinates (`[lng, lat, ...]`) of the trackpoints of a segment.
    pub fn segment_coordinates(&self, id: &TrackSegmentId) -> &[f64] {
        self.coordinates_cache.segment(id)
    }

    /// Coordinates (`[lng, lat, ...]`) of the waypoints of a file.
    pub fn waypoint_coordinates(&self, id: &FileId) -> &[f64] {
        self.coordinates_cache.waypoints(id)
    }

    /// Single entry point for every action coming from the frontend. Returns whether anything
    /// changed.
    pub fn execute(&mut self, action: Action) -> bool {
        let selection_before = self.selection.clone();
        let order_before = self.order.0.clone();
        // the files change iff there is a diff, but selection and order actions have none
        self.diff = match action {
            Action::Edit(command) => self.edit(command),
            Action::Undo => self.stack.undo(),
            Action::Redo => self.stack.redo(),
            Action::Select {
                mut selection,
                mode,
            } => {
                match self.stack.current() {
                    Some(files) => selection.retain_existing(files),
                    None => selection = Selection::Empty,
                }
                match mode {
                    SelectMode::Replace => self.selection = selection,
                    // nothing to add or toggle: keep the selection
                    _ if selection == Selection::Empty => {}
                    SelectMode::Add => self.selection.extend(selection),
                    SelectMode::Toggle => self.selection.toggle(selection),
                }
                None
            }
            Action::Reorder { file_ids, index } => {
                self.order.move_files(&file_ids, index);
                None
            }
        };
        let changed = self.diff.is_some()
            || self.selection != selection_before
            || self.order.0 != order_before;
        if changed {
            self.refresh();
        }
        // after the refresh, which also syncs the order and selection with the files (undo, redo)
        self.order_changed = self.order.0 != order_before;
        self.selection_changed = self.selection != selection_before;
        changed
    }

    fn edit(&mut self, command: Command) -> Option<Diff> {
        self.stack.create_and_push_next(|files| {
            let mut state = State {
                files,
                selection: &mut self.selection,
                order: &mut self.order,
            };
            command.apply(&mut state).map_err(|err| err.to_string())
        })
    }

    /// Brings everything derived from the files back in line with the current stack entry.
    fn refresh(&mut self) {
        let current = self.stack.current();
        match current {
            Some(files) => {
                // files coming back after an undo/redo are added at the end of the order
                self.order.sync(files);
                self.selection.retain_existing(files);
            }
            None => {
                self.order.0.clear();
                self.selection = Selection::Empty;
            }
        }
        self.statistics_cache.update(current);
        self.coordinates_cache.update(current);
        self.structure_cache.update(current, self.diff.as_ref());
        self.statistics_buffer
            .update(
                &self
                    .statistics_cache
                    .selected(current, &self.selection, &self.order.0),
            );
    }
}

#[cfg(test)]
mod tests {
    use crate::{Load, Metadata, New, NewTrack, Style, TrackId, TrackSegmentId};

    use super::*;

    fn edit(engine: &mut Engine, command: Command) -> bool {
        engine.execute(Action::Edit(command))
    }

    fn new(engine: &mut Engine, name: &str) -> bool {
        edit(engine, Command::New(New { name }))
    }

    fn load(engine: &mut Engine, path: &str) -> bool {
        let data = std::fs::read(path).unwrap();
        edit(
            engine,
            Command::Load(Load {
                data: &data,
                name: "file",
            }),
        )
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
                data: b"<gpx><trk></gpx>",
                name: "file",
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
    fn test_reorder_is_not_undoable_and_returning_files_go_last() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        let a = engine.order.0[0];
        new(&mut engine, "b");
        let b = engine.order.0[1];
        new(&mut engine, "c");
        let c = engine.order.0[2];

        assert!(engine.execute(Action::Reorder {
            file_ids: vec![c],
            index: 0
        }));
        assert_eq!(engine.order.0, vec![c, a, b]);
        assert!(!engine.execute(Action::Reorder {
            file_ids: vec![c],
            index: 0
        }));

        // undoing the creation of c does not undo the reorder
        assert!(engine.execute(Action::Undo));
        assert_eq!(engine.order.0, vec![a, b]);
        // c comes back at the end
        assert!(engine.execute(Action::Redo));
        assert_eq!(engine.order.0, vec![a, b, c]);
    }

    #[test]
    fn test_structures_and_coordinates_follow_actions() {
        let mut engine = Engine::default();
        assert!(engine.order().is_empty());
        load(&mut engine, "data/simple.gpx");
        let loaded_id = engine.order()[0];
        let diff = engine.last_diff().unwrap();
        assert_eq!(diff.added, vec![loaded_id]);
        assert!(engine.order_changed());

        new(&mut engine, "empty");
        let empty_id = engine.order()[1];
        // only the new file is reported, the other one is not recomputed
        let diff = engine.last_diff().unwrap();
        assert_eq!(diff.added, vec![empty_id]);
        assert!(diff.modified.is_empty() && diff.removed.is_empty());
        assert_eq!(engine.file_structure(&empty_id).unwrap().name, "empty");

        let structure = engine.file_structure(&loaded_id).unwrap();
        let seg = &structure.tracks[0].segments[0];
        let (seg_id, len) = (seg.id, seg.len);
        assert_eq!(engine.segment_coordinates(&seg_id).len(), len * 2);
        assert!(engine.waypoint_coordinates(&loaded_id).is_empty());

        // reordering only changes the order
        assert!(engine.execute(Action::Reorder {
            file_ids: vec![loaded_id],
            index: 1
        }));
        assert_eq!(engine.order(), [empty_id, loaded_id]);
        assert!(engine.last_diff().is_none());
        assert!(engine.order_changed());

        // an action that changes nothing reports nothing
        assert!(!engine.execute(Action::Reorder {
            file_ids: vec![loaded_id],
            index: 1
        }));
        assert!(engine.last_diff().is_none());
        assert!(!engine.order_changed());

        // undo removes the empty file, redoing the load removes the other one too
        assert!(engine.execute(Action::Undo));
        let diff = engine.last_diff().unwrap();
        assert_eq!(diff.removed, vec![empty_id]);
        assert!(engine.order_changed());
        assert!(engine.file_structure(&empty_id).is_none());
        assert!(engine.execute(Action::Undo));
        assert!(engine.order().is_empty());
        assert!(engine.file_structure(&loaded_id).is_none());
        assert!(engine.segment_coordinates(&seg_id).is_empty());
    }

    #[test]
    fn test_selection_changed_flag() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        let a = engine.order()[0];
        // a new file is selected by the edit
        assert!(engine.selection_changed());
        assert!(!select_files(&mut engine, &[a]));
        assert!(!engine.selection_changed());
        assert!(select_files(&mut engine, &[]));
        assert!(engine.selection_changed());
        // undoing drops the selected file from the selection
        select_files(&mut engine, &[a]);
        assert!(engine.execute(Action::Undo));
        assert!(engine.selection_changed());
        assert_eq!(engine.selection(), &Selection::Empty);
    }

    #[test]
    fn test_undo_updates_statistics() {
        let mut engine = Engine::default();
        load(&mut engine, "data/simple.gpx");
        assert!(!engine.statistics().total_distance.is_empty());
        engine.execute(Action::Undo);
        assert!(engine.statistics().total_distance.is_empty());
        engine.execute(Action::Redo);
        select_all(&mut engine);
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

        assert!(select_files(&mut engine, &[a]));
        assert_eq!(selected(&engine), vec![a]);

        assert!(select_elements(&mut engine, files(&[b]), SelectMode::Add));
        assert_eq!(selected(&engine).len(), 2);

        select_files(&mut engine, &[]);
        assert!(select_all(&mut engine));
        assert_eq!(selected(&engine).len(), 2);
    }

    #[test]
    fn test_selection_does_not_create_undo_steps() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        select_all(&mut engine);
        engine.execute(Action::Undo);
        assert!(engine.stack.current().is_none());
    }

    fn select_elements(engine: &mut Engine, selection: Selection, mode: SelectMode) -> bool {
        engine.execute(Action::Select { selection, mode })
    }

    fn files(ids: &[FileId]) -> Selection {
        Selection::File {
            file_ids: ids.iter().copied().collect(),
        }
    }

    fn select_files(engine: &mut Engine, ids: &[FileId]) -> bool {
        select_elements(engine, files(ids), SelectMode::Replace)
    }

    fn select_all(engine: &mut Engine) -> bool {
        let ids = engine.order().to_vec();
        select_files(engine, &ids)
    }

    #[test]
    fn test_select_elements() {
        let mut engine = Engine::default();
        load(&mut engine, "data/with_tracks_and_segments.gpx");
        let file = engine
            .stack
            .current()
            .unwrap()
            .values()
            .next()
            .unwrap()
            .clone();
        assert!(file.trk.len() >= 2 && file.trk[0].trkseg.len() >= 2);
        let (t0, t1) = (file.trk[0].id, file.trk[1].id);
        let (s0, s1) = (file.trk[0].trkseg[0].id, file.trk[0].trkseg[1].id);

        // tracks, then more tracks
        let tracks = |ids: &[TrackId]| Selection::Track {
            file_id: file.id,
            trk_ids: ids.iter().copied().collect(),
        };
        assert!(select_elements(
            &mut engine,
            tracks(&[t0]),
            SelectMode::Replace
        ));
        assert_eq!(engine.selection(), &tracks(&[t0]));
        assert!(select_elements(&mut engine, tracks(&[t1]), SelectMode::Add));
        assert_eq!(engine.selection(), &tracks(&[t0, t1]));

        // segments of a track, added only within the same track
        let segments = |trk_id, ids: &[TrackSegmentId]| Selection::TrackSegment {
            file_id: file.id,
            trk_id,
            trkseg_ids: ids.iter().copied().collect(),
        };
        assert!(select_elements(
            &mut engine,
            segments(t0, &[s0]),
            SelectMode::Add
        ));
        assert_eq!(engine.selection(), &segments(t0, &[s0]));
        assert!(select_elements(
            &mut engine,
            segments(t0, &[s1]),
            SelectMode::Add
        ));
        assert_eq!(engine.selection(), &segments(t0, &[s0, s1]));
        // the statistics follow the selected segments
        assert_eq!(
            engine.statistics().total_distance.len(),
            file.trk[0].trkseg[0].len() + file.trk[0].trkseg[1].len()
        );

        // the waypoints node
        let node = Selection::Waypoints { file_id: file.id };
        assert!(select_elements(
            &mut engine,
            node.clone(),
            SelectMode::Replace
        ));
        assert!(!select_elements(&mut engine, node.clone(), SelectMode::Add));
        assert_eq!(engine.selection(), &node);
        assert!(engine.selection_changed() == false);

        // unknown elements and files are ignored when adding
        let unknown = tracks(&[TrackId::default()]);
        assert!(!select_elements(
            &mut engine,
            unknown.clone(),
            SelectMode::Add
        ));
        let unknown_file = Selection::Waypoints {
            file_id: FileId::default(),
        };
        assert!(!select_elements(
            &mut engine,
            unknown_file.clone(),
            SelectMode::Add
        ));
        assert!(!select_elements(
            &mut engine,
            Selection::Empty,
            SelectMode::Add
        ));
        assert_eq!(engine.selection(), &node);

        // and select nothing otherwise
        assert!(select_elements(&mut engine, unknown, SelectMode::Replace));
        assert_eq!(engine.selection(), &Selection::Empty);
        select_elements(&mut engine, node, SelectMode::Replace);
        assert!(select_elements(
            &mut engine,
            unknown_file,
            SelectMode::Replace
        ));
        assert_eq!(engine.selection(), &Selection::Empty);
    }

    #[test]
    fn test_toggle_elements() {
        let mut engine = Engine::default();
        load(&mut engine, "data/with_tracks_and_segments.gpx");
        let file = engine
            .stack
            .current()
            .unwrap()
            .values()
            .next()
            .unwrap()
            .clone();
        let (t0, t1) = (file.trk[0].id, file.trk[1].id);
        let tracks = |ids: &[TrackId]| Selection::Track {
            file_id: file.id,
            trk_ids: ids.iter().copied().collect(),
        };
        let toggle = |engine: &mut Engine, ids: &[TrackId]| {
            select_elements(engine, tracks(ids), SelectMode::Toggle)
        };

        select_elements(&mut engine, tracks(&[t0]), SelectMode::Replace);
        assert!(toggle(&mut engine, &[t1]));
        assert_eq!(engine.selection(), &tracks(&[t0, t1]));
        assert!(toggle(&mut engine, &[t0]));
        assert_eq!(engine.selection(), &tracks(&[t1]));
        // toggling the last element deselects everything
        assert!(toggle(&mut engine, &[t1]));
        assert_eq!(engine.selection(), &Selection::Empty);
        // unknown elements change nothing
        assert!(!toggle(&mut engine, &[TrackId::default()]));
        assert_eq!(engine.selection(), &Selection::Empty);
    }

    #[test]
    fn test_selected_elements_are_dropped_when_they_disappear() {
        let mut engine = Engine::default();
        load(&mut engine, "data/with_tracks_and_segments.gpx");
        let file = engine
            .stack
            .current()
            .unwrap()
            .values()
            .next()
            .unwrap()
            .clone();
        let trk_id = file.trk[0].id;
        select_elements(
            &mut engine,
            Selection::Track {
                file_id: file.id,
                trk_ids: [trk_id].into(),
            },
            SelectMode::Replace,
        );
        engine.execute(Action::Undo);
        assert_eq!(engine.selection(), &Selection::Empty);
    }
}
