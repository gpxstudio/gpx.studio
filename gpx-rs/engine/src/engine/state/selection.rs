use std::collections::HashSet;

use crate::{FileId, StackEntry, TrackId, TrackSegmentId, WaypointId};

/// How a new selection combines with the current one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SelectMode {
    /// The new selection replaces the current one.
    Replace,
    /// The elements are added when they are of the same kind and in the same place as the
    /// current selection (see [`Selection::extend`]), otherwise they replace it.
    Add,
    /// Like `Add`, but the elements already selected are removed instead (see
    /// [`Selection::toggle`]).
    Toggle,
}

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

/// Where a track segment is: its file, then its track and its own position in it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SegmentLocation {
    pub file_id: FileId,
    pub trk: usize,
    pub seg: usize,
}

impl Selection {
    /// The track segments covered by the selection, in order: the segments of several selected
    /// files follow `order` (the files missing from it come last), then the tracks and segments
    /// follow the file. Waypoints are not segments: selecting only waypoints covers none.
    pub fn segment_locations(&self, files: &StackEntry, order: &[FileId]) -> Vec<SegmentLocation> {
        let mut locations = vec![];
        let mut add = |file_id: FileId,
                       trk_filter: &dyn Fn(&crate::Track) -> bool,
                       seg_filter: &dyn Fn(&crate::TrackSegment) -> bool| {
            let Some(file) = files.get(&file_id) else {
                return;
            };
            for (trk, track) in file.trk.iter().enumerate().filter(|(_, t)| trk_filter(t)) {
                for (seg, segment) in track.trkseg.iter().enumerate() {
                    if seg_filter(segment) {
                        locations.push(SegmentLocation { file_id, trk, seg });
                    }
                }
            }
        };
        match self {
            Selection::Empty | Selection::Waypoints { .. } | Selection::Waypoint { .. } => (),
            Selection::File { file_ids } => {
                let ordered = order
                    .iter()
                    .filter(|id| file_ids.contains(id))
                    .chain(file_ids.iter().filter(|id| !order.contains(id)));
                for id in ordered {
                    add(*id, &|_| true, &|_| true);
                }
            }
            Selection::Track { file_id, trk_ids } => {
                add(*file_id, &|trk| trk_ids.contains(&trk.id), &|_| true)
            }
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => add(*file_id, &|trk| trk.id == *trk_id, &|seg| {
                trkseg_ids.contains(&seg.id)
            }),
        }
        locations
    }

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
                    wpt_ids.retain(|id| file.wpt.iter().any(|wpt| wpt.id == *id));
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

    /// Like [`Selection::extend`], but the elements of `other` that are already selected are
    /// removed from the selection instead. A selection left with nothing is empty.
    pub fn toggle(&mut self, other: Selection) {
        fn toggle_ids<T: std::hash::Hash + Eq>(ids: &mut HashSet<T>, other: HashSet<T>) {
            for id in other {
                if !ids.remove(&id) {
                    ids.insert(id);
                }
            }
        }
        let empty = match (&mut *self, other) {
            (Selection::File { file_ids }, Selection::File { file_ids: other }) => {
                toggle_ids(file_ids, other);
                file_ids.is_empty()
            }
            (
                Selection::Track { file_id, trk_ids },
                Selection::Track {
                    file_id: other_file,
                    trk_ids: other,
                },
            ) if *file_id == other_file => {
                toggle_ids(trk_ids, other);
                trk_ids.is_empty()
            }
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
            ) if *file_id == other_file && *trk_id == other_trk => {
                toggle_ids(trkseg_ids, other);
                trkseg_ids.is_empty()
            }
            (Selection::Waypoints { file_id }, Selection::Waypoints { file_id: other })
                if *file_id == other =>
            {
                true
            }
            (
                Selection::Waypoint { file_id, wpt_ids },
                Selection::Waypoint {
                    file_id: other_file,
                    wpt_ids: other,
                },
            ) if *file_id == other_file => {
                toggle_ids(wpt_ids, other);
                wpt_ids.is_empty()
            }
            (selection, other) => {
                *selection = other;
                false
            }
        };
        if empty {
            *self = Selection::Empty;
        }
    }
}

/// Position of the first and last of the `selected` ids among the `all` ids.
fn selected_range<T: std::hash::Hash + Eq>(
    all: impl Iterator<Item = T>,
    selected: &HashSet<T>,
) -> Option<(usize, usize)> {
    let mut range: Option<(usize, usize)> = None;
    for (i, id) in all.enumerate() {
        if selected.contains(&id) {
            range = Some(range.map_or((i, i), |(first, _)| (first, i)));
        }
    }
    range
}

/// The id before or after the selected ones among `ids`, without wrapping around.
fn neighbour<T: Copy + PartialEq + std::hash::Hash + Eq>(
    ids: &[T],
    selected: &HashSet<T>,
    down: bool,
) -> Option<T> {
    let (first, last) = selected_range(ids.iter().copied(), selected)?;
    if down {
        ids.get(last + 1).copied()
    } else {
        first.checked_sub(1).map(|i| ids[i])
    }
}

impl Selection {
    /// The files holding the selected elements, as a selection of files.
    pub fn to_files(&self) -> Selection {
        match self {
            Selection::Empty => Selection::Empty,
            Selection::File { .. } => self.clone(),
            Selection::Track { file_id, .. }
            | Selection::TrackSegment { file_id, .. }
            | Selection::Waypoints { file_id }
            | Selection::Waypoint { file_id, .. } => Selection::File {
                file_ids: [*file_id].into(),
            },
        }
    }

    /// Selects all the elements of the same kind as the selected ones, in the same place: all
    /// the files, all the tracks of the file, all the segments of the track, all the waypoints
    /// of the file. All the files when nothing is selected. `None` when there is nothing to
    /// select (the waypoints node, or a file that does not exist).
    pub fn all_at_level(&self, files: &StackEntry, order: &[FileId]) -> Option<Selection> {
        match self {
            Selection::Empty | Selection::File { .. } => Some(Selection::File {
                file_ids: order.iter().copied().collect(),
            }),
            Selection::Track { file_id, .. } => Some(Selection::Track {
                file_id: *file_id,
                trk_ids: files.get(file_id)?.trk.iter().map(|trk| trk.id).collect(),
            }),
            Selection::TrackSegment {
                file_id, trk_id, ..
            } => {
                let trk = files
                    .get(file_id)?
                    .trk
                    .iter()
                    .find(|trk| trk.id == *trk_id)?;
                Some(Selection::TrackSegment {
                    file_id: *file_id,
                    trk_id: *trk_id,
                    trkseg_ids: trk.trkseg.iter().map(|seg| seg.id).collect(),
                })
            }
            Selection::Waypoints { .. } => None,
            Selection::Waypoint { file_id, .. } => Some(Selection::Waypoint {
                file_id: *file_id,
                wpt_ids: files.get(file_id)?.wpt.iter().map(|wpt| wpt.id).collect(),
            }),
        }
    }

    /// The element next to the selected ones, as a selection of that one element: the next one
    /// (`down`) or the previous one among the elements of the same kind, in the same place.
    /// The tracks, segments and waypoints stop at their ends, the files wrap around and skip
    /// the ones that are already selected. `None` when there is no such element.
    pub fn neighbour(&self, files: &StackEntry, order: &[FileId], down: bool) -> Option<Selection> {
        match self {
            Selection::Empty | Selection::Waypoints { .. } => None,
            Selection::File { file_ids } => {
                let (first, last) = selected_range(order.iter(), &file_ids.iter().collect())?;
                let limit = if down { last } else { first };
                let n = order.len();
                let mut i = limit;
                loop {
                    i = if down { (i + 1) % n } else { (i + n - 1) % n };
                    if i == limit {
                        return None;
                    }
                    if !file_ids.contains(&order[i]) {
                        return Some(Selection::File {
                            file_ids: [order[i]].into(),
                        });
                    }
                }
            }
            Selection::Track { file_id, trk_ids } => {
                let ids: Vec<TrackId> = files.get(file_id)?.trk.iter().map(|t| t.id).collect();
                Some(Selection::Track {
                    file_id: *file_id,
                    trk_ids: [neighbour(&ids, trk_ids, down)?].into(),
                })
            }
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => {
                let trk = files
                    .get(file_id)?
                    .trk
                    .iter()
                    .find(|trk| trk.id == *trk_id)?;
                let ids: Vec<TrackSegmentId> = trk.trkseg.iter().map(|seg| seg.id).collect();
                Some(Selection::TrackSegment {
                    file_id: *file_id,
                    trk_id: *trk_id,
                    trkseg_ids: [neighbour(&ids, trkseg_ids, down)?].into(),
                })
            }
            Selection::Waypoint { file_id, wpt_ids } => {
                let ids: Vec<WaypointId> =
                    files.get(file_id)?.wpt.iter().map(|wpt| wpt.id).collect();
                Some(Selection::Waypoint {
                    file_id: *file_id,
                    wpt_ids: [neighbour(&ids, wpt_ids, down)?].into(),
                })
            }
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
        file.wpt.push(WaypointChunk {
            wpt: vec![Waypoint::default()],
            ..Default::default()
        });
        let (file_id, trk_id) = (file.id, file.trk[0].id);
        let (seg_id, wpt_id) = (file.trk[0].trkseg[0].id, file.wpt[0].id);
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

    #[test]
    fn test_toggle() {
        let file_id = FileId::default();
        let (a, b) = (TrackId::default(), TrackId::default());
        let tracks = |ids: &[TrackId]| Selection::Track {
            file_id,
            trk_ids: ids.iter().copied().collect(),
        };

        // same kind and place: toggled one by one
        let mut selection = tracks(&[a]);
        selection.toggle(tracks(&[b]));
        assert_eq!(selection, tracks(&[a, b]));
        selection.toggle(tracks(&[a]));
        assert_eq!(selection, tracks(&[b]));
        selection.toggle(tracks(&[a, b]));
        assert_eq!(selection, tracks(&[a]));

        // nothing left: empty
        selection.toggle(tracks(&[a]));
        assert_eq!(selection, Selection::Empty);

        // another file, or another kind: replaced
        let mut selection = tracks(&[a]);
        selection.toggle(Selection::Waypoints { file_id });
        assert_eq!(selection, Selection::Waypoints { file_id });
        // the waypoints node toggles itself off
        selection.toggle(Selection::Waypoints { file_id });
        assert_eq!(selection, Selection::Empty);

        // files
        let (f1, f2) = (FileId::default(), FileId::default());
        let files = |ids: &[FileId]| Selection::File {
            file_ids: ids.iter().copied().collect(),
        };
        let mut selection = files(&[f1]);
        selection.toggle(files(&[f2]));
        assert_eq!(selection, files(&[f1, f2]));
        selection.toggle(files(&[f1]));
        assert_eq!(selection, files(&[f2]));
    }

    /// A file with 3 tracks of 2 segments each and 3 waypoints, with the ids of everything.
    struct Tree {
        files: StackEntry,
        order: Vec<FileId>,
        file: FileId,
        tracks: Vec<TrackId>,
        segments: Vec<Vec<TrackSegmentId>>,
        waypoints: Vec<WaypointId>,
    }

    fn tree() -> Tree {
        let mut file = File::default();
        for _ in 0..3 {
            file.trk.push(Track {
                trkseg: vec![TrackSegment::default(), TrackSegment::default()],
                ..Default::default()
            });
        }
        file.wpt.push(WaypointChunk {
            wpt: vec![Waypoint::default(), Waypoint::default()],
            ..Default::default()
        });
        file.wpt.push(WaypointChunk {
            wpt: vec![Waypoint::default()],
            ..Default::default()
        });
        Tree {
            file: file.id,
            tracks: file.trk.iter().map(|t| t.id).collect(),
            segments: file
                .trk
                .iter()
                .map(|t| t.trkseg.iter().map(|s| s.id).collect())
                .collect(),
            waypoints: file.wpt.iter().map(|w| w.id).collect(),
            order: vec![file.id],
            files: StackEntry::from([(file.id, Rc::new(file))]),
        }
    }

    #[test]
    fn test_all_at_level() {
        let t = tree();
        let other = FileId::default();
        let order = [other, t.file];
        let all = |selection: &Selection| selection.all_at_level(&t.files, &order);

        // the files, in the order
        let all_files = Selection::File {
            file_ids: [other, t.file].into(),
        };
        assert_eq!(all(&Selection::Empty), Some(all_files.clone()));
        assert_eq!(
            all(&Selection::File {
                file_ids: [t.file].into()
            }),
            Some(all_files)
        );

        // the siblings of the selected elements
        assert_eq!(
            all(&Selection::Track {
                file_id: t.file,
                trk_ids: [t.tracks[1]].into()
            }),
            Some(Selection::Track {
                file_id: t.file,
                trk_ids: t.tracks.iter().copied().collect()
            })
        );
        assert_eq!(
            all(&Selection::TrackSegment {
                file_id: t.file,
                trk_id: t.tracks[2],
                trkseg_ids: [t.segments[2][0]].into()
            }),
            Some(Selection::TrackSegment {
                file_id: t.file,
                trk_id: t.tracks[2],
                trkseg_ids: t.segments[2].iter().copied().collect()
            })
        );
        assert_eq!(
            all(&Selection::Waypoint {
                file_id: t.file,
                wpt_ids: [t.waypoints[0]].into()
            }),
            Some(Selection::Waypoint {
                file_id: t.file,
                wpt_ids: t.waypoints.iter().copied().collect()
            })
        );

        // nothing to select
        assert_eq!(all(&Selection::Waypoints { file_id: t.file }), None);
        let unknown = FileId::default();
        assert_eq!(
            all(&Selection::Track {
                file_id: unknown,
                trk_ids: HashSet::new()
            }),
            None
        );
    }

    #[test]
    fn test_neighbour_of_tracks_stops_at_the_ends() {
        let t = tree();
        let tracks = |ids: &[TrackId]| Selection::Track {
            file_id: t.file,
            trk_ids: ids.iter().copied().collect(),
        };
        let next = |selection: &Selection, down| selection.neighbour(&t.files, &t.order, down);

        assert_eq!(
            next(&tracks(&[t.tracks[1]]), true),
            Some(tracks(&[t.tracks[2]]))
        );
        assert_eq!(
            next(&tracks(&[t.tracks[1]]), false),
            Some(tracks(&[t.tracks[0]]))
        );
        assert_eq!(next(&tracks(&[t.tracks[2]]), true), None);
        assert_eq!(next(&tracks(&[t.tracks[0]]), false), None);
        // from the end of the selected range, whatever its holes
        let range = tracks(&[t.tracks[0], t.tracks[1]]);
        assert_eq!(next(&range, true), Some(tracks(&[t.tracks[2]])));
        assert_eq!(next(&range, false), None);
        let holes = tracks(&[t.tracks[0], t.tracks[2]]);
        assert_eq!(next(&holes, true), None);
        assert_eq!(next(&holes, false), None);
    }

    #[test]
    fn test_neighbour_of_segments_and_waypoints() {
        let t = tree();
        let segments = |trk: usize, seg: usize| Selection::TrackSegment {
            file_id: t.file,
            trk_id: t.tracks[trk],
            trkseg_ids: [t.segments[trk][seg]].into(),
        };
        let next = |selection: &Selection, down| selection.neighbour(&t.files, &t.order, down);
        // the segments stay in their track
        assert_eq!(next(&segments(1, 0), true), Some(segments(1, 1)));
        assert_eq!(next(&segments(1, 1), true), None);
        assert_eq!(next(&segments(1, 1), false), Some(segments(1, 0)));
        assert_eq!(next(&segments(1, 0), false), None);

        // the waypoints are in the order of the file, across its chunks
        let waypoint = |i: usize| Selection::Waypoint {
            file_id: t.file,
            wpt_ids: [t.waypoints[i]].into(),
        };
        assert_eq!(next(&waypoint(1), true), Some(waypoint(2)));
        assert_eq!(next(&waypoint(2), true), None);
        assert_eq!(next(&waypoint(0), false), None);
        assert_eq!(next(&waypoint(2), false), Some(waypoint(1)));

        assert_eq!(next(&Selection::Waypoints { file_id: t.file }, true), None);
        assert_eq!(next(&Selection::Empty, true), None);
    }

    #[test]
    fn test_neighbour_of_files_wraps_around_and_skips_the_selected() {
        let files = StackEntry::default();
        let [a, b, c] = [FileId::default(), FileId::default(), FileId::default()];
        let order = [a, b, c];
        let select = |ids: &[FileId]| Selection::File {
            file_ids: ids.iter().copied().collect(),
        };
        let next = |ids: &[FileId], down| select(ids).neighbour(&files, &order, down);

        assert_eq!(next(&[a], true), Some(select(&[b])));
        assert_eq!(next(&[c], true), Some(select(&[a])));
        assert_eq!(next(&[a], false), Some(select(&[c])));
        assert_eq!(next(&[b], false), Some(select(&[a])));
        // from the end of the selection, skipping the files already selected
        assert_eq!(next(&[a, b], true), Some(select(&[c])));
        assert_eq!(next(&[a, b], false), Some(select(&[c])));
        assert_eq!(next(&[c, a], true), Some(select(&[b])));
        // everything is selected
        assert_eq!(next(&[a, b, c], true), None);
        // none of them is in the order
        assert_eq!(next(&[FileId::default()], true), None);
    }

    #[test]
    fn test_to_files() {
        let (file_id, trk_id) = (FileId::default(), TrackId::default());
        let file = Selection::File {
            file_ids: [file_id].into(),
        };
        assert_eq!(Selection::Empty.to_files(), Selection::Empty);
        assert_eq!(file.to_files(), file);
        assert_eq!(
            Selection::Track {
                file_id,
                trk_ids: [trk_id].into()
            }
            .to_files(),
            file
        );
        assert_eq!(
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids: HashSet::new()
            }
            .to_files(),
            file
        );
        assert_eq!(Selection::Waypoints { file_id }.to_files(), file);
        assert_eq!(
            Selection::Waypoint {
                file_id,
                wpt_ids: HashSet::new()
            }
            .to_files(),
            file
        );
        let several = Selection::File {
            file_ids: [file_id, FileId::default()].into(),
        };
        assert_eq!(several.to_files(), several);
    }
}
