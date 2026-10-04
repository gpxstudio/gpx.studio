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
    /// Drops what does not exist anymore (e.g. after an undo): files, and the tracks, segments
    /// and waypoints of the files that remain. A selection left with nothing becomes empty.
    pub fn retain_existing(&mut self, files: &StackEntry) {
        let empty = match self {
            Selection::Empty => false,
            Selection::File { file_ids } => {
                file_ids.retain(|id| files.contains_key(id));
                file_ids.is_empty()
            }
            Selection::Track { file_id, trk_ids } => match files.get(file_id) {
                Some(file) => {
                    trk_ids.retain(|id| file.trk.iter().any(|trk| trk.id == *id));
                    trk_ids.is_empty()
                }
                None => true,
            },
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => match files
                .get(file_id)
                .and_then(|file| file.trk.iter().find(|trk| trk.id == *trk_id))
            {
                Some(trk) => {
                    trkseg_ids.retain(|id| trk.trkseg.iter().any(|seg| seg.id == *id));
                    trkseg_ids.is_empty()
                }
                None => true,
            },
            Selection::Waypoints { file_id } => !files.contains_key(file_id),
            Selection::Waypoint { file_id, wpt_ids } => match files.get(file_id) {
                Some(file) => {
                    wpt_ids.retain(|id| {
                        file.wpt
                            .iter()
                            .flat_map(|chunk| &chunk.wpt)
                            .any(|wpt| wpt.id == *id)
                    });
                    wpt_ids.is_empty()
                }
                None => true,
            },
        };
        if empty {
            *self = Selection::Empty;
        }
    }

    /// Adds `other` to the selection: the elements are merged when they are of the same kind and
    /// in the same place (same file, same track for segments), otherwise `other` replaces the
    /// selection.
    pub fn extend(&mut self, other: Selection) {
        match (&mut *self, other) {
            (Selection::File { file_ids }, Selection::File { file_ids: other }) => {
                file_ids.extend(other)
            }
            (
                Selection::Track { file_id, trk_ids },
                Selection::Track {
                    file_id: other_file,
                    trk_ids: other,
                },
            ) if *file_id == other_file => trk_ids.extend(other),
            (
                Selection::TrackSegment {
                    file_id,
                    trk_id,
                    trkseg_ids,
                },
                Selection::TrackSegment {
                    file_id: other_file,
                    trk_id: other_trk,
                    trkseg_ids: other,
                },
            ) if *file_id == other_file && *trk_id == other_trk => trkseg_ids.extend(other),
            (Selection::Waypoints { file_id }, Selection::Waypoints { file_id: other })
                if *file_id == other => {}
            (
                Selection::Waypoint { file_id, wpt_ids },
                Selection::Waypoint {
                    file_id: other_file,
                    wpt_ids: other,
                },
            ) if *file_id == other_file => wpt_ids.extend(other),
            (selection, other) => *selection = other,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::{File, Track, TrackSegment, Waypoint, WaypointChunk};

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

    #[test]
    fn test_retain_existing_elements() {
        let mut file = File::default();
        file.trk.push(Track {
            trkseg: vec![TrackSegment::default()],
            ..Default::default()
        });
        file.wpt.push(Rc::new(WaypointChunk {
            wpt: vec![Waypoint::default()],
            ..Default::default()
        }));
        let (file_id, trk_id) = (file.id, file.trk[0].id);
        let (seg_id, wpt_id) = (file.trk[0].trkseg[0].id, file.wpt[0].wpt[0].id);
        let mut files = StackEntry::default();
        files.insert(file_id, Rc::new(file));

        let mut selection = Selection::Track {
            file_id,
            trk_ids: [trk_id, TrackId::default()].into(),
        };
        selection.retain_existing(&files);
        assert_eq!(
            selection,
            Selection::Track {
                file_id,
                trk_ids: [trk_id].into()
            }
        );

        let mut selection = Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids: [seg_id, TrackSegmentId::default()].into(),
        };
        selection.retain_existing(&files);
        assert!(
            matches!(&selection, Selection::TrackSegment { trkseg_ids, .. } if trkseg_ids.len() == 1)
        );
        // a segment under the wrong track
        let mut selection = Selection::TrackSegment {
            file_id,
            trk_id: TrackId::default(),
            trkseg_ids: [seg_id].into(),
        };
        selection.retain_existing(&files);
        assert_eq!(selection, Selection::Empty);

        let mut selection = Selection::Waypoint {
            file_id,
            wpt_ids: [wpt_id, WaypointId::default()].into(),
        };
        selection.retain_existing(&files);
        assert!(matches!(&selection, Selection::Waypoint { wpt_ids, .. } if wpt_ids.len() == 1));
        let mut selection = Selection::Waypoint {
            file_id,
            wpt_ids: [WaypointId::default()].into(),
        };
        selection.retain_existing(&files);
        assert_eq!(selection, Selection::Empty);
    }

    #[test]
    fn test_extend() {
        let file_id = FileId::default();
        let (a, b) = (TrackId::default(), TrackId::default());
        let tracks = |ids: &[TrackId]| Selection::Track {
            file_id,
            trk_ids: ids.iter().copied().collect(),
        };

        // same kind and place: merged
        let mut selection = tracks(&[a]);
        selection.extend(tracks(&[b]));
        assert_eq!(selection, tracks(&[a, b]));

        // another file, or another kind: replaced
        let mut selection = tracks(&[a]);
        let other = Selection::Track {
            file_id: FileId::default(),
            trk_ids: [b].into(),
        };
        selection.extend(other.clone());
        assert_eq!(selection, other);
        selection.extend(Selection::Waypoints { file_id });
        assert_eq!(selection, Selection::Waypoints { file_id });

        // segments of another track: replaced
        let seg = TrackSegmentId::default();
        let segments = |trk_id| Selection::TrackSegment {
            file_id,
            trk_id,
            trkseg_ids: [seg].into(),
        };
        let mut selection = segments(a);
        selection.extend(segments(b));
        assert_eq!(selection, segments(b));
    }
}
