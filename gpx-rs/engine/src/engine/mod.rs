mod action;
mod command;
mod derived;
mod outcome;
mod state;

pub use action::*;
pub use command::*;
pub use derived::*;
pub use outcome::*;
pub use state::*;

use crate::{
    ExportOptions, FileId, GlobalStatistics, Restored, Snapshot, TrackSegmentId, Trackpoint,
    TrackpointCategories, Waypoint, WaypointId, reduction_distances, write,
};

#[derive(Debug, Default)]
pub struct Engine {
    stack: Stack,
    selection: Selection,
    order: FileOrder,
    statistics_cache: StatisticsCache,
    coordinates_cache: CoordinatesCache,
    structure_cache: FileStructureCache,
    statistics_buffer: StatisticsBuffer,
    routing_buffer: RoutingBuffer,
    categories: TrackpointCategories,
    clipboard: Option<Clipboard>,
    /// What the tests of the last action read, see `Engine::run`.
    #[cfg(test)]
    last: Outcome,
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
    /// the state to start from: they cannot be undone. The files are reported as added, and the
    /// order, the selection and the clipboard as changed.
    pub fn restore(&mut self, restored: Restored) -> Outcome {
        let files: StackEntry = restored
            .files
            .into_iter()
            .map(|file| (file.id, file))
            .collect();
        self.categories = restored.categories;
        self.order = FileOrder(restored.order);
        self.selection = Selection::Empty;
        self.clipboard = None;
        let mut diff = Some(Diff {
            added: files.keys().copied().collect(),
            ..Default::default()
        });
        self.stack = Stack::restored(files);
        self.refresh(diff.as_ref());
        sort_diff(&mut diff, &self.order.0);
        let outcome = Outcome {
            changed: true,
            diff,
            order_changed: true,
            selection_changed: true,
            clipboard_changed: true,
            error: None,
        };
        #[cfg(test)]
        {
            self.last = outcome.clone();
        }
        outcome
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

    /// Currently selected elements.
    pub fn selection(&self) -> &Selection {
        &self.selection
    }

    /// Coordinates (`[lng, lat, ...]`) of the trackpoints of a segment.
    pub fn segment_coordinates(&self, id: &TrackSegmentId) -> &[f64] {
        self.coordinates_cache.segment(id)
    }

    /// Coordinates (`[lng, lat, ...]`) of the waypoints of a file.
    pub fn waypoint_coordinates(&self, id: &FileId) -> &[f64] {
        self.coordinates_cache.waypoints(id)
    }

    /// Single entry point for every action coming from the frontend. Says what it changed.
    pub fn execute(&mut self, action: Action) -> Outcome {
        let selection_before = self.selection.clone();
        let order_before = self.order.0.clone();
        let clipboard_before = self.clipboard.clone();
        let is_edit = matches!(action, Action::Edit(_));
        let mut error = None;
        // the files change iff there is a diff, but selection and order actions have none
        let mut diff = match action {
            Action::Edit(command) => self.edit(command).unwrap_or_else(|err| {
                error = Some(err);
                None
            }),
            Action::Undo => self.stack.undo(),
            Action::Redo => self.stack.redo(),
            Action::Select { selection, mode } => {
                self.selection.select(self.stack.current(), selection, mode);
                None
            }
            Action::SelectAll => {
                if let Some(files) = self.stack.current() {
                    self.selection.select_all(files, &self.order.0);
                }
                None
            }
            Action::ArrowSelect { down, add } => {
                if let Some(files) = self.stack.current() {
                    self.selection
                        .select_neighbour(files, &self.order.0, down, add);
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
        let changed = diff.is_some()
            || self.selection != selection_before
            || self.order.0 != order_before
            || self.clipboard != clipboard_before;
        if is_edit && !changed && error.is_none() {
            error = Some(CommandError::NothingToDo);
        }
        if changed {
            self.refresh(diff.as_ref());
            sort_diff(&mut diff, &self.order.0);
        }
        // after the refresh, which also syncs the order and selection with the files (undo, redo)
        let outcome = Outcome {
            changed,
            diff,
            order_changed: self.order.0 != order_before,
            selection_changed: self.selection != selection_before,
            clipboard_changed: self.clipboard != clipboard_before,
            error,
        };
        #[cfg(test)]
        {
            self.last = outcome.clone();
        }
        outcome
    }

    /// Puts the selection in the clipboard, if there is one.
    fn copy(&mut self, cut: bool) {
        if let Some(files) = self.stack.current()
            && let Some(clipboard) = Clipboard::new(&self.selection, files, &self.order.0, cut)
        {
            self.clipboard = Some(clipboard);
        }
    }

    fn edit(&mut self, command: Command) -> Result<Option<Diff>, CommandError> {
        self.stack.create_and_push_next(|files| {
            let mut state = State {
                categories: &mut self.categories,
                files,
                selection: &mut self.selection,
                order: &mut self.order,
                clipboard: &mut self.clipboard,
            };
            command.apply(&mut state)
        })
    }

    /// Brings everything derived from the files back in line with the current stack entry.
    fn refresh(&mut self, diff: Option<&Diff>) {
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
        self.structure_cache.update(current, diff);
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

/// Puts the files of a diff in the order of the files (the stack does not know it), so that
/// whatever is done with them one after the other, like giving them colors, follows it.
fn sort_diff(diff: &mut Option<Diff>, order: &[FileId]) {
    let position = |id: &FileId| order.iter().position(|other| other == id);
    if let Some(diff) = diff {
        diff.added.sort_by_key(position);
        diff.modified.sort_by_key(position);
    }
}

#[cfg(test)]
impl Engine {
    /// Executes an action and tells whether it changed anything. What it did is kept for the
    /// accessors below, which the tests read right after.
    pub(crate) fn run(&mut self, action: Action) -> bool {
        self.execute(action).changed
    }

    pub(crate) fn last_diff(&self) -> Option<&Diff> {
        self.last.diff.as_ref()
    }

    pub(crate) fn last_error(&self) -> Option<&CommandError> {
        self.last.error.as_ref()
    }

    pub(crate) fn order_changed(&self) -> bool {
        self.last.order_changed
    }

    pub(crate) fn selection_changed(&self) -> bool {
        self.last.selection_changed
    }

    pub(crate) fn clipboard_changed(&self) -> bool {
        self.last.clipboard_changed
    }
}

#[cfg(test)]
mod tests;
