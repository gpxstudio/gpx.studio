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
    history: History,
    selection: Selection,
    order: FileOrder,
    statistics_cache: StatisticsCache,
    coordinates_cache: CoordinatesCache,
    structure_cache: FileStructureCache,
    statistics_buffer: StatisticsBuffer,
    routing_buffer: RoutingBuffer,
    categories: TrackpointCategories,
    clipboard: Option<Clipboard>,
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
        let file = self.history.current()?.get(id)?;
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
        self.history
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
            .history
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
        let Some(files) = self.history.current() else {
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
            files: self.history.current().cloned().unwrap_or_default(),
            order: self.order.0.clone(),
            categories: self.categories.clone(),
        }
    }

    /// Replaces what the engine holds by the files read from the storage: at the start, or when
    /// another writer (a tab) committed since, which makes what was held here out of date. What
    /// was here is gone, edits that were not saved included, and the files are the state to start
    /// from: they cannot be undone, and nothing from before can be.
    ///
    /// The selection keeps what still exists, and so does the clipboard. The files that differ
    /// from the ones that were here are reported as added, removed or modified (all the files
    /// that were here, as they are not the same objects), and the order as changed if it is.
    pub fn restore(&mut self, restored: Restored) -> Outcome {
        let selection_before = self.selection.clone();
        let order_before = self.order.0.clone();
        let before = self.history.current().cloned();
        let files: Files = restored
            .files
            .into_iter()
            .map(|file| (file.id, file))
            .collect();
        let diff = History::diff_between(before.as_ref(), Some(&files));
        let mut diff =
            (!(diff.added.is_empty() && diff.removed.is_empty() && diff.modified.is_empty()))
                .then_some(diff);
        self.categories = restored.categories;
        self.order = FileOrder(restored.order);
        self.history = History::restored(files);
        self.refresh(diff.as_ref());
        sort_diff(&mut diff, &self.order.0);
        Outcome {
            changed: diff.is_some()
                || self.order.0 != order_before
                || self.selection != selection_before,
            diff,
            order_changed: self.order.0 != order_before,
            selection_changed: self.selection != selection_before,
            clipboard_changed: false,
        }
    }

    /// A file as GPX (UTF-8), `None` if it does not exist.
    pub fn export(&self, id: &FileId, options: ExportOptions) -> Option<Vec<u8>> {
        let file = self.history.current()?.get(id)?;
        Some(write(file, &self.categories, options))
    }

    /// The data that the given files have, which the options of `export` can leave out.
    pub fn exportable_data(&self, ids: &[FileId]) -> ExportOptions {
        let Some(files) = self.history.current() else {
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
        self.history.can_undo()
    }

    /// Whether there is something to redo.
    pub fn can_redo(&self) -> bool {
        self.history.can_redo()
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

    /// Single entry point for every action coming from the frontend. Says what it changed, or why
    /// it did nothing: an edit that fails or has nothing to do.
    pub fn execute(&mut self, action: Action) -> Result<Outcome, CommandError> {
        let selection_before = self.selection.clone();
        let order_before = self.order.0.clone();
        let clipboard_before = self.clipboard.clone();
        let is_edit = matches!(action, Action::Edit(_));
        // the files change iff there is a diff, but selection and order actions have none
        let mut diff = match action {
            Action::Edit(command) => self.edit(command)?,
            Action::Undo => self.history.undo(),
            Action::Redo => self.history.redo(),
            Action::Select { selection, mode } => {
                self.selection
                    .select(self.history.current(), selection, mode);
                None
            }
            Action::SelectAll => {
                if let Some(files) = self.history.current() {
                    self.selection.select_all(files, &self.order.0);
                }
                None
            }
            Action::ArrowSelect { down, add } => {
                if let Some(files) = self.history.current() {
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
        if is_edit && !changed {
            return Err(CommandError::NothingToDo);
        }
        if changed {
            self.refresh(diff.as_ref());
            sort_diff(&mut diff, &self.order.0);
        }
        // after the refresh, which also syncs the order and selection with the files (undo, redo)
        Ok(Outcome {
            changed,
            diff,
            order_changed: self.order.0 != order_before,
            selection_changed: self.selection != selection_before,
            clipboard_changed: self.clipboard != clipboard_before,
        })
    }

    /// Puts the selection in the clipboard, if there is one.
    fn copy(&mut self, cut: bool) {
        if let Some(files) = self.history.current()
            && let Some(clipboard) = Clipboard::new(&self.selection, files, &self.order.0, cut)
        {
            self.clipboard = Some(clipboard);
        }
    }

    fn edit(&mut self, command: Command) -> Result<Option<Diff>, CommandError> {
        self.history.create_and_push_next(|files| {
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

    /// Brings everything derived from the files back in line with the current history entry.
    fn refresh(&mut self, diff: Option<&Diff>) {
        let current = self.history.current();
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

/// Puts the files of a diff in the order of the files (the history does not know it), so that
/// whatever is done with them one after the other, like giving them colors, follows it.
fn sort_diff(diff: &mut Option<Diff>, order: &[FileId]) {
    let position = |id: &FileId| order.iter().position(|other| other == id);
    if let Some(diff) = diff {
        diff.added.sort_by_key(position);
        diff.modified.sort_by_key(position);
    }
}

#[cfg(test)]
mod tests;
