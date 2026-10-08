use crate::{
    Action, Apply, Clipboard, Command, CoordinatesCache, Diff, ExportOptions, FileId, FileOrder,
    FileStructure, FileStructureCache, GlobalStatistics, Restored, RoutingBuffer, SelectMode,
    Selection, Snapshot, Stack, StackEntry, State, StatisticsBuffer, StatisticsCache,
    TrackSegmentId, Trackpoint, TrackpointCategories, Waypoint, WaypointId, reduction_distances,
    write,
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
    routing_buffer: RoutingBuffer,
    categories: TrackpointCategories,
    clipboard: Option<Clipboard>,
    clipboard_changed: bool,
}

impl Engine {
    pub fn statistics(&self) -> &StatisticsBuffer {
        &self.statistics_buffer
    }

    /// The anchors of the routing tool among the trackpoints of the selection.
    pub fn routing(&self) -> &RoutingBuffer {
        &self.routing_buffer
    }

    /// The names of the surfaces and highways that the trackpoints refer to by code.
    pub fn categories(&self) -> &TrackpointCategories {
        &self.categories
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

    /// What was copied or cut and is waiting to be pasted.
    pub fn clipboard(&self) -> Option<&Clipboard> {
        self.clipboard.as_ref()
    }

    /// Whether the clipboard can be pasted with the current selection.
    pub fn can_paste(&self) -> bool {
        self.clipboard
            .as_ref()
            .is_some_and(|clipboard| clipboard.can_paste(&self.selection))
    }

    /// Whether the last action changed the clipboard.
    pub fn clipboard_changed(&self) -> bool {
        self.clipboard_changed
    }

    /// A waypoint of a file, with all its data. `None` if it does not exist.
    pub fn waypoint(&self, file_id: &FileId, id: &WaypointId) -> Option<&Waypoint> {
        self.stack
            .current()?
            .get(file_id)?
            .wpt
            .iter()
            .find(|wpt| wpt.id == *id)
    }

    /// A trackpoint of a segment of a file. `None` if it does not exist.
    pub fn trackpoint(
        &self,
        file_id: &FileId,
        segment_id: &TrackSegmentId,
        index: usize,
    ) -> Option<&Trackpoint> {
        let segment = self
            .stack
            .current()?
            .get(file_id)?
            .trk
            .iter()
            .flat_map(|trk| &trk.trkseg)
            .find(|seg| seg.id == *segment_id)?;
        (index < segment.len()).then(|| &segment[index])
    }

    /// For each trackpoint of the selection (numbered as in the statistics), the tolerance up to
    /// which `Reduce` keeps it, see [`reduction_distances`].
    pub fn reduction_distances(&self) -> Vec<f64> {
        let Some(files) = self.stack.current() else {
            return vec![];
        };
        self.selection
            .segment_locations(files, &self.order.0)
            .iter()
            .flat_map(|location| {
                reduction_distances(
                    &files[&location.file_id].trk[location.trk].trkseg[location.seg],
                )
            })
            .collect()
    }

    /// What there is to keep of the engine, see [`crate::Persister`].
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            files: self.stack.current().cloned().unwrap_or_default(),
            order: self.order.0.clone(),
            categories: self.categories.clone(),
        }
    }

    /// Puts files in an engine that has none, typically the ones read from the storage. They are
    /// the state to start from: they cannot be undone. The files that were added are reported as
    /// the last diff, and the order as changed.
    pub fn restore(&mut self, restored: Restored) {
        let files: StackEntry = restored
            .files
            .into_iter()
            .map(|file| (file.id, file))
            .collect();
        self.categories = restored.categories;
        self.order = FileOrder(restored.order);
        self.selection = Selection::Empty;
        self.clipboard = None;
        self.diff = Some(Diff {
            added: files.keys().copied().collect(),
            ..Default::default()
        });
        self.stack = Stack::restored(files);
        self.refresh();
        self.sort_diff();
        self.order_changed = true;
        self.selection_changed = true;
        self.clipboard_changed = true;
    }

    /// A file as GPX (UTF-8), `None` if it does not exist.
    pub fn export(&self, id: &FileId, options: ExportOptions) -> Option<Vec<u8>> {
        let file = self.stack.current()?.get(id)?;
        Some(write(file, &self.categories, options))
    }

    /// The data that the given files have, which the options of `export` can leave out.
    pub fn exportable_data(&self, ids: &[FileId]) -> ExportOptions {
        let Some(files) = self.stack.current() else {
            return ExportOptions::NONE;
        };
        ids.iter()
            .filter_map(|id| files.get(id))
            .fold(ExportOptions::NONE, |data, file| {
                data.union(file.exportable_data())
            })
    }

    /// Whether there is something to undo.
    pub fn can_undo(&self) -> bool {
        self.stack.can_undo()
    }

    /// Whether there is something to redo.
    pub fn can_redo(&self) -> bool {
        self.stack.can_redo()
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
        let clipboard_before = self.clipboard.clone();
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
            Action::SelectAll => {
                if let Some(files) = self.stack.current()
                    && let Some(all) = self.selection.all_at_level(files, &self.order.0)
                {
                    self.selection = all;
                }
                None
            }
            Action::ArrowSelect { down, add } => {
                if let Some(files) = self.stack.current()
                    && let Some(next) = self.selection.neighbour(files, &self.order.0, down)
                {
                    if add {
                        self.selection.extend(next);
                    } else {
                        self.selection = next;
                    }
                }
                None
            }
            Action::Copy => {
                self.copy(false);
                None
            }
            Action::Cut => {
                self.copy(true);
                None
            }
            Action::Reorder { file_ids, index } => {
                self.order.move_files(&file_ids, index);
                None
            }
        };
        let changed = self.diff.is_some()
            || self.selection != selection_before
            || self.order.0 != order_before
            || self.clipboard != clipboard_before;
        if changed {
            self.refresh();
            self.sort_diff();
        }
        // after the refresh, which also syncs the order and selection with the files (undo, redo)
        self.order_changed = self.order.0 != order_before;
        self.selection_changed = self.selection != selection_before;
        self.clipboard_changed = self.clipboard != clipboard_before;
        changed
    }

    /// Puts the selection in the clipboard, if there is one.
    fn copy(&mut self, cut: bool) {
        if let Some(files) = self.stack.current()
            && let Some(clipboard) = Clipboard::new(&self.selection, files, &self.order.0, cut)
        {
            self.clipboard = Some(clipboard);
        }
    }

    fn edit(&mut self, command: Command) -> Option<Diff> {
        self.stack.create_and_push_next(|files| {
            let mut state = State {
                categories: &mut self.categories,
                files,
                selection: &mut self.selection,
                order: &mut self.order,
                clipboard: &mut self.clipboard,
            };
            command.apply(&mut state).map_err(|err| err.to_string())
        })
    }

    /// Puts the files of the last diff in the order of the files (the stack does not know it), so
    /// that whatever is done with them one after the other, like giving them colors, follows it.
    fn sort_diff(&mut self) {
        let position = |id: &FileId| self.order.0.iter().position(|other| other == id);
        if let Some(diff) = &mut self.diff {
            diff.added.sort_by_key(position);
            diff.modified.sort_by_key(position);
        }
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
        self.routing_buffer
            .update(current, &self.selection, &self.order.0);
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
    use std::collections::HashSet;

    use crate::{
        ClipboardIds, Delete, DeleteAll, Load, Metadata, New, NewTrack, Paste, Style, TrackId,
        TrackSegmentId,
    };

    use super::*;

    fn expand(intervals: &crate::Intervals, len: usize) -> Vec<u8> {
        let mut values = Vec::new();
        for (i, value) in intervals.values.iter().enumerate() {
            let end = intervals.starts.get(i + 1).map_or(len, |end| *end as usize);
            values.resize(end, *value);
        }
        values
    }

    fn edit(engine: &mut Engine, command: Command) -> bool {
        engine.execute(Action::Edit(command))
    }

    fn new(engine: &mut Engine, name: &str) -> bool {
        edit(
            engine,
            Command::New(New {
                name,
                trackpoint: None,
            }),
        )
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

    #[test]
    fn test_can_undo_and_redo() {
        let mut engine = Engine::default();
        assert!(!engine.can_undo() && !engine.can_redo());
        new(&mut engine, "a");
        assert!(engine.can_undo() && !engine.can_redo());
        assert!(engine.execute(Action::Undo));
        assert!(!engine.can_undo() && engine.can_redo());
        // selecting does not change the history
        new(&mut engine, "b");
        let a = engine.order()[0];
        select_files(&mut engine, &[a]);
        assert!(engine.can_undo() && !engine.can_redo());
        assert!(engine.execute(Action::Undo));
        assert!(engine.execute(Action::Redo));
        assert!(engine.can_undo() && !engine.can_redo());
    }

    #[test]
    fn test_select_all_follows_the_selected_level() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        new(&mut engine, "b");
        let order = engine.order().to_vec();
        select_files(&mut engine, &[order[0]]);

        // files
        assert!(engine.execute(Action::SelectAll));
        assert_eq!(engine.selection(), &files(&order));
        // everything is selected already
        assert!(!engine.execute(Action::SelectAll));

        // the tracks of a file
        let load = |engine: &mut Engine| load(engine, "data/with_tracks_and_segments.gpx");
        load(&mut engine);
        let file = engine
            .stack
            .current()
            .unwrap()
            .values()
            .find(|f| !f.trk.is_empty())
            .unwrap()
            .clone();
        let tracks: HashSet<_> = file.trk.iter().map(|t| t.id).collect();
        assert!(tracks.len() >= 2);
        select_elements(
            &mut engine,
            Selection::Track {
                file_id: file.id,
                trk_ids: [file.trk[0].id].into(),
            },
            SelectMode::Replace,
        );
        assert!(engine.execute(Action::SelectAll));
        assert_eq!(
            engine.selection(),
            &Selection::Track {
                file_id: file.id,
                trk_ids: tracks
            }
        );

        // nothing selected: all the files
        select_elements(&mut engine, Selection::Empty, SelectMode::Replace);
        assert!(engine.execute(Action::SelectAll));
        assert!(matches!(engine.selection(), Selection::File { file_ids } if file_ids.len() == 3));
        // the waypoints node: nothing more to select
        select_elements(
            &mut engine,
            Selection::Waypoints { file_id: file.id },
            SelectMode::Replace,
        );
        assert!(!engine.execute(Action::SelectAll));
        assert_eq!(
            engine.selection(),
            &Selection::Waypoints { file_id: file.id }
        );
    }

    #[test]
    fn test_arrow_select() {
        let mut engine = Engine::default();
        new(&mut engine, "file");
        for _ in 0..3 {
            edit(&mut engine, Command::NewTrack(NewTrack));
        }
        let file = engine
            .stack
            .current()
            .unwrap()
            .values()
            .next()
            .unwrap()
            .clone();
        let ids: Vec<TrackId> = file.trk.iter().map(|t| t.id).collect();
        assert_eq!(ids.len(), 3);
        let tracks = |ids: &[TrackId]| Selection::Track {
            file_id: file.id,
            trk_ids: ids.iter().copied().collect(),
        };
        let arrow =
            |engine: &mut Engine, down, add| engine.execute(Action::ArrowSelect { down, add });

        select_elements(&mut engine, tracks(&[ids[0]]), SelectMode::Replace);
        // without shift the next one replaces the selection
        assert!(arrow(&mut engine, true, false));
        assert_eq!(engine.selection(), &tracks(&[ids[1]]));
        assert!(engine.selection_changed());
        // with shift it is added
        assert!(arrow(&mut engine, true, true));
        assert_eq!(engine.selection(), &tracks(&[ids[1], ids[2]]));
        // the selection grows from its end, and the other way round from its start
        assert!(arrow(&mut engine, false, true));
        assert_eq!(engine.selection(), &tracks(&[ids[0], ids[1], ids[2]]));
        // at the ends nothing happens
        assert!(!arrow(&mut engine, false, false));
        assert!(!arrow(&mut engine, true, true));
        assert_eq!(engine.selection(), &tracks(&[ids[0], ids[1], ids[2]]));
        // and there is nothing to move without selection
        select_elements(&mut engine, Selection::Empty, SelectMode::Replace);
        assert!(!arrow(&mut engine, true, false));
        assert_eq!(engine.selection(), &Selection::Empty);
    }

    #[test]
    fn test_arrow_select_does_not_create_undo_steps() {
        let mut engine = Engine::default();
        new(&mut engine, "a");
        new(&mut engine, "b");
        let a = engine.order()[0];
        select_files(&mut engine, &[a]);
        let before = engine.can_redo();
        assert!(engine.execute(Action::ArrowSelect {
            down: true,
            add: false
        }));
        assert_eq!(engine.can_redo(), before);
        assert_eq!(engine.selection(), &files(&[engine.order()[1]]));
        assert!(engine.execute(Action::Undo));
        assert_eq!(engine.order().len(), 1);
    }

    /// A file named `name` with `n` tracks, selected.
    fn file_with_tracks(engine: &mut Engine, name: &str, n: usize) -> FileId {
        new(engine, name);
        for _ in 0..n {
            edit(engine, Command::NewTrack(NewTrack));
        }
        *engine.order().last().unwrap()
    }

    fn track_ids(engine: &Engine, id: FileId) -> Vec<TrackId> {
        engine
            .file_structure(&id)
            .unwrap()
            .tracks
            .iter()
            .map(|t| t.id)
            .collect()
    }

    fn paste(engine: &mut Engine) -> bool {
        edit(engine, Command::Paste(Paste))
    }

    #[test]
    fn test_copy_and_paste() {
        let mut engine = Engine::default();
        let a = file_with_tracks(&mut engine, "a", 2);
        let b = file_with_tracks(&mut engine, "b", 0);
        assert!(engine.clipboard().is_none() && !engine.can_paste());

        // nothing selected, nothing copied
        select_elements(&mut engine, Selection::Empty, SelectMode::Replace);
        assert!(!engine.execute(Action::Copy));
        assert!(engine.clipboard().is_none());

        let tracks = track_ids(&engine, a);
        let selected_tracks = Selection::Track {
            file_id: a,
            trk_ids: tracks.iter().copied().collect(),
        };
        select_elements(&mut engine, selected_tracks.clone(), SelectMode::Replace);
        assert!(engine.execute(Action::Copy));
        assert!(engine.clipboard_changed() && !engine.selection_changed());
        assert_eq!(
            engine.clipboard().map(|c| (c.content.ids(), c.cut)),
            Some((ClipboardIds::Tracks(tracks.clone()), false))
        );
        // tracks cannot be pasted onto themselves... but into a track, a file or the list of files
        assert!(engine.can_paste());
        select_elements(&mut engine, files(&[b]), SelectMode::Replace);
        assert!(engine.can_paste());
        select_elements(
            &mut engine,
            Selection::Waypoints { file_id: b },
            SelectMode::Replace,
        );
        assert!(!engine.can_paste());
        select_elements(&mut engine, files(&[b]), SelectMode::Replace);

        // pasting is an edit
        assert!(paste(&mut engine));
        assert_eq!(track_ids(&engine, a), tracks);
        assert_eq!(track_ids(&engine, b).len(), 2);
        // a copy stays in the clipboard, to be pasted again
        assert!(engine.clipboard().is_some() && !engine.clipboard_changed());
        assert!(
            matches!(engine.selection(), Selection::Track { file_id, trk_ids } if *file_id == b && trk_ids.len() == 2)
        );
        assert!(engine.can_paste());
        assert!(paste(&mut engine));
        assert_eq!(track_ids(&engine, b).len(), 4);
        assert_eq!(track_ids(&engine, a), tracks);

        // and it can be undone
        assert!(engine.execute(Action::Undo));
        assert_eq!(track_ids(&engine, b).len(), 2);
        assert!(engine.execute(Action::Undo));
        assert!(track_ids(&engine, b).is_empty());
    }

    #[test]
    fn test_cut_and_paste_moves_after_the_paste() {
        let mut engine = Engine::default();
        let a = file_with_tracks(&mut engine, "a", 2);
        let b = file_with_tracks(&mut engine, "b", 0);
        let tracks = track_ids(&engine, a);
        select_elements(
            &mut engine,
            Selection::Track {
                file_id: a,
                trk_ids: [tracks[0]].into(),
            },
            SelectMode::Replace,
        );
        assert!(engine.execute(Action::Cut));
        assert!(engine.clipboard().is_some_and(|c| c.cut));
        // nothing moves before the paste
        assert_eq!(track_ids(&engine, a), tracks);

        select_elements(&mut engine, files(&[b]), SelectMode::Replace);
        assert!(paste(&mut engine));
        assert_eq!(track_ids(&engine, a), vec![tracks[1]]);
        assert_eq!(track_ids(&engine, b), vec![tracks[0]]);
        assert!(engine.execute(Action::Undo));
        assert_eq!(track_ids(&engine, a), tracks);
        assert!(track_ids(&engine, b).is_empty());
    }

    #[test]
    fn test_clipboard_survives_what_happens_to_the_elements() {
        let mut engine = Engine::default();
        let a = file_with_tracks(&mut engine, "a", 2);
        let tracks = track_ids(&engine, a);
        select_elements(
            &mut engine,
            Selection::Track {
                file_id: a,
                trk_ids: tracks.iter().copied().collect(),
            },
            SelectMode::Replace,
        );
        engine.execute(Action::Copy);
        let clipboard = engine.clipboard().cloned();
        assert!(clipboard.is_some());

        // one of the tracks is deleted, then the whole file: the clipboard is not affected
        select_elements(
            &mut engine,
            Selection::Track {
                file_id: a,
                trk_ids: [tracks[0]].into(),
            },
            SelectMode::Replace,
        );
        assert!(edit(
            &mut engine,
            Command::Delete(Delete { whole_files: false })
        ));
        select_elements(&mut engine, files(&[a]), SelectMode::Replace);
        assert!(edit(&mut engine, Command::DeleteAll(DeleteAll)));
        assert_eq!(engine.clipboard(), clipboard.as_ref());
        assert!(!engine.clipboard_changed());

        // both tracks are pasted in a new file, as they were when they were copied
        let b = file_with_tracks(&mut engine, "b", 0);
        select_files(&mut engine, &[b]);
        assert!(engine.can_paste());
        assert!(paste(&mut engine));
        let pasted = track_ids(&engine, b);
        assert_eq!(pasted.len(), 2);
        // copies, with new ids
        assert!(pasted.iter().all(|id| !tracks.contains(id)));
        // and again
        assert!(paste(&mut engine));
        assert_eq!(track_ids(&engine, b).len(), 4);
    }

    #[test]
    fn test_copy_replaces_the_clipboard_and_does_not_change_the_history() {
        let mut engine = Engine::default();
        let a = file_with_tracks(&mut engine, "a", 0);
        let b = file_with_tracks(&mut engine, "b", 0);
        select_files(&mut engine, &[a]);
        engine.execute(Action::Copy);
        select_files(&mut engine, &[b]);
        assert!(engine.execute(Action::Cut));
        assert_eq!(
            engine.clipboard().map(|c| (c.content.ids(), c.cut)),
            Some((ClipboardIds::Files(vec![b]), true))
        );
        // the same elements again are a new copy
        assert!(engine.execute(Action::Cut));
        assert!(engine.clipboard_changed());
        // only the creations of the files are in the history
        assert!(engine.execute(Action::Undo));
        assert!(engine.execute(Action::Undo));
        assert!(!engine.can_undo());
    }

    #[test]
    fn test_move_elements_is_an_edit_and_selects_what_moved() {
        use crate::{Move, MoveTarget};

        let mut engine = Engine::default();
        let a = file_with_tracks(&mut engine, "a", 3);
        let tracks = track_ids(&engine, a);
        let moved = Selection::Track {
            file_id: a,
            trk_ids: [tracks[2]].into(),
        };
        assert!(edit(
            &mut engine,
            Command::Move(Move {
                what: moved.clone(),
                to: MoveTarget::Tracks {
                    file_id: a,
                    index: 0
                },
            })
        ));
        assert_eq!(track_ids(&engine, a), vec![tracks[2], tracks[0], tracks[1]]);
        assert_eq!(engine.selection(), &moved);

        // invalid moves change nothing
        assert!(!edit(
            &mut engine,
            Command::Move(Move {
                what: moved,
                to: MoveTarget::Waypoints {
                    file_id: a,
                    index: 0
                },
            })
        ));

        assert!(engine.execute(Action::Undo));
        assert_eq!(track_ids(&engine, a), tracks);
    }

    #[test]
    fn test_added_files_are_reported_in_the_order_of_the_files() {
        use crate::LoadFiles;

        let mut engine = Engine::default();
        let datas: Vec<Vec<u8>> = (0..12)
            .map(|i| {
                format!(r#"<gpx version="1.1"><metadata><name>{i}</name></metadata></gpx>"#)
                    .into_bytes()
            })
            .collect();
        let loads = datas
            .iter()
            .map(|data| Load { data, name: "x" })
            .collect::<Vec<_>>();
        assert!(edit(
            &mut engine,
            Command::LoadFiles(LoadFiles { files: loads })
        ));
        assert_eq!(engine.last_diff().unwrap().added, engine.order());

        // files that come back with an undo too
        assert!(engine.execute(Action::Undo));
        assert!(engine.execute(Action::Redo));
        assert_eq!(engine.last_diff().unwrap().added, engine.order());
    }

    #[test]
    fn test_load_several_files_is_one_edit() {
        use crate::LoadFiles;

        let mut engine = Engine::default();
        new(&mut engine, "before");
        let gpx = |name: &str| {
            format!(r#"<gpx version="1.1"><metadata><name>{name}</name></metadata></gpx>"#)
                .into_bytes()
        };
        let (a, b) = (gpx("a"), gpx("b"));
        assert!(edit(
            &mut engine,
            Command::LoadFiles(LoadFiles {
                files: vec![
                    Load {
                        data: &a,
                        name: "x"
                    },
                    Load {
                        data: &b,
                        name: "x"
                    },
                ],
            })
        ));
        assert_eq!(engine.order().len(), 3);
        let diff = engine.last_diff().unwrap();
        assert_eq!(diff.added.len(), 2);
        // the first one that was loaded is selected
        assert_eq!(engine.selection(), &files(&[engine.order()[1]]));

        // a single undo removes both
        assert!(engine.execute(Action::Undo));
        assert_eq!(engine.order().len(), 1);
        assert!(engine.execute(Action::Redo));
        assert_eq!(engine.order().len(), 3);
    }

    #[test]
    fn test_create_edit_and_move_a_waypoint() {
        use crate::{EditWaypoint, MoveWaypoint, NewWaypoint};

        let mut engine = Engine::default();
        new(&mut engine, "file");
        let file = engine.order()[0];
        assert!(edit(
            &mut engine,
            Command::NewWaypoint(NewWaypoint {
                lng: 4.0,
                lat: 50.0,
                ele: 10.0,
                name: "created",
                desc: "",
                icon: "Flag",
                link: "",
            })
        ));
        let id = engine.file_structure(&file).unwrap().waypoints[0].id;
        let waypoint = engine.waypoint(&file, &id).unwrap();
        assert_eq!(waypoint.name.as_deref(), Some("created"));
        assert_eq!(waypoint.sym.as_deref(), Some("Flag"));
        assert_eq!(waypoint.ele, 10.0);
        // unknown waypoint or file
        assert!(engine.waypoint(&file, &Default::default()).is_none());
        assert!(engine.waypoint(&Default::default(), &id).is_none());

        // no selection needed
        assert!(edit(
            &mut engine,
            Command::MoveWaypoint(MoveWaypoint {
                file_id: file,
                waypoint_id: id,
                lng: 5.0,
                lat: 51.0,
                ele: 20.0,
            })
        ));
        let moved = engine.waypoint(&file, &id).unwrap();
        assert_eq!(
            (moved.coordinates.lng, moved.coordinates.lat, moved.ele),
            (5.0, 51.0, 20.0)
        );
        assert_eq!(moved.name.as_deref(), Some("created"));
        // the coordinates buffer follows
        assert_eq!(engine.waypoint_coordinates(&file), &[5.0, 51.0]);

        assert!(edit(
            &mut engine,
            Command::EditWaypoint(EditWaypoint {
                file_id: file,
                waypoint_id: id,
                lng: 6.0,
                lat: 52.0,
                ele: 30.0,
                name: "edited",
                desc: "text",
                icon: "",
                link: "https://example.com",
            })
        ));
        let edited = engine.waypoint(&file, &id).unwrap();
        assert_eq!(edited.name.as_deref(), Some("edited"));
        assert_eq!(edited.cmt.as_deref(), Some("text"));
        assert!(edited.sym.is_none());
        assert_eq!(engine.waypoint_coordinates(&file), &[6.0, 52.0]);

        // each of them can be undone
        assert!(engine.execute(Action::Undo));
        assert_eq!(
            engine.waypoint(&file, &id).unwrap().name.as_deref(),
            Some("created")
        );
        assert!(engine.execute(Action::Undo));
        assert_eq!(engine.waypoint_coordinates(&file), &[4.0, 50.0]);

        // deleting does not need a selection either
        assert!(edit(
            &mut engine,
            Command::DeleteWaypoint(crate::DeleteWaypoint {
                file_id: file,
                waypoint_id: id,
            })
        ));
        assert!(engine.waypoint(&file, &id).is_none());
        assert!(engine.waypoint_coordinates(&file).is_empty());
        assert!(engine.execute(Action::Undo));
        assert!(engine.waypoint(&file, &id).is_some());
    }

    #[test]
    fn test_categories_are_shared_and_kept_by_the_history() {
        let mut engine = Engine::default();
        assert!(engine.categories().surface.names().is_empty());

        load(&mut engine, "data/with_highway.gpx");
        assert_eq!(engine.categories().surface.names(), ["asphalt", "gravel"]);
        assert_eq!(
            engine.categories().highway.names(),
            ["residential", "track"]
        );
        // the trackpoints of the selection refer to them
        assert_eq!(expand(&engine.statistics().surface, 5), [1, 1, 0, 2, 2]);
        assert_eq!(expand(&engine.statistics().highway, 5), [1, 1, 0, 2, 0]);
        assert_eq!(
            engine.categories().sac_scale.names(),
            ["mountain_hiking", "hiking"]
        );
        assert_eq!(expand(&engine.statistics().sac_scale, 5), [0, 0, 0, 1, 2]);
        assert_eq!(expand(&engine.statistics().mtb_scale, 5), [0, 0, 0, 1, 1]);

        // a second file goes on with the same table
        load(&mut engine, "data/with_surface.gpx");
        assert_eq!(
            engine.categories().surface.names(),
            ["asphalt", "gravel", "cobblestone"]
        );
        assert_eq!(engine.statistics().len(), 80);
        let surface = expand(&engine.statistics().surface, 80);
        assert_eq!(surface[0], 1);
        assert_eq!(surface.iter().filter(|c| **c == 3).count(), 1);

        // undoing does not forget what was learned: the codes stay valid in every state
        assert!(engine.execute(Action::Undo));
        assert!(engine.execute(Action::Undo));
        assert_eq!(
            engine.categories().surface.names(),
            ["asphalt", "gravel", "cobblestone"]
        );
        assert!(engine.execute(Action::Redo));
        let first = engine.order()[0];
        select_files(&mut engine, &[first]);
        assert_eq!(expand(&engine.statistics().surface, 5), [1, 1, 0, 2, 2]);
    }

    #[test]
    fn test_trackpoint() {
        let mut engine = Engine::default();
        load(&mut engine, "data/simple.gpx");
        let file = engine.order()[0];
        let structure = engine.file_structure(&file).unwrap();
        let seg = &structure.tracks[0].segments[0];
        let (seg_id, len) = (seg.id, seg.len);
        let coordinates = engine.segment_coordinates(&seg_id).to_vec();
        let last = engine.trackpoint(&file, &seg_id, len - 1).unwrap();
        assert_eq!(
            [last.coordinates.lng, last.coordinates.lat],
            coordinates[(len - 1) * 2..]
        );
        assert!(engine.trackpoint(&file, &seg_id, len).is_none());
        assert!(engine.trackpoint(&Default::default(), &seg_id, 0).is_none());
    }
}
