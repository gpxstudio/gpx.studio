use std::collections::HashSet;

use crate::{FileId, StackEntry, TrackId, TrackSegmentId, WaypointId};

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub enum Selection {
    #[default]
    Empty,
    File {
        file_ids: HashSet<FileId>,
    },
    Track {
        file_id: FileId,
        trk_ids: HashSet<TrackId>,
    },
    TrackSegment {
        file_id: FileId,
        trk_id: TrackId,
        trkseg_ids: HashSet<TrackSegmentId>,
    },
    Waypoints {
        file_id: FileId,
    },
    Waypoint {
        file_id: FileId,
        wpt_ids: HashSet<WaypointId>,
    },
}

impl Selection {
    /// Drops the files that do not exist anymore (e.g. after an undo).
    pub fn retain_existing(&mut self, files: &StackEntry) {
        match self {
            Selection::Empty => {}
            Selection::File { file_ids } => {
                file_ids.retain(|id| files.contains_key(id));
                if file_ids.is_empty() {
                    *self = Selection::Empty;
                }
            }
            Selection::Track { file_id, .. }
            | Selection::TrackSegment { file_id, .. }
            | Selection::Waypoints { file_id }
            | Selection::Waypoint { file_id, .. } => {
                if !files.contains_key(file_id) {
                    *self = Selection::Empty;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::File;

    use super::*;

    #[test]
    fn test_retain_existing() {
        let file = File::default();
        let (kept, gone) = (file.id, FileId::default());
        let mut files = StackEntry::default();
        files.insert(kept, Rc::new(file));

        let mut selection = Selection::File {
            file_ids: [kept, gone].into(),
        };
        selection.retain_existing(&files);
        assert!(
            matches!(&selection, Selection::File { file_ids } if file_ids.len() == 1 && file_ids.contains(&kept))
        );

        let mut selection = Selection::File {
            file_ids: [gone].into(),
        };
        selection.retain_existing(&files);
        assert!(matches!(selection, Selection::Empty));

        let mut selection = Selection::Waypoints { file_id: kept };
        selection.retain_existing(&files);
        assert!(matches!(selection, Selection::Waypoints { .. }));
        let mut selection = Selection::Waypoints { file_id: gone };
        selection.retain_existing(&files);
        assert!(matches!(selection, Selection::Empty));
    }
}
