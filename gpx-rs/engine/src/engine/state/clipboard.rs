use std::rc::Rc;

use uuid::Uuid;

use crate::{
    File, FileId, Selection, StackEntry, Track, TrackId, TrackSegment, TrackSegmentId, Waypoint,
    WaypointId,
};

/// A track in the clipboard, with the name of the file it comes from (the name of the new file
/// when it is pasted on its own).
#[derive(Debug, Clone)]
pub struct ClipboardTrack {
    pub track: Track,
    pub file_name: String,
}

/// A segment in the clipboard, with the name of its track, or of its file when the track has
/// none (the name of the new file when it is pasted on its own).
#[derive(Debug, Clone)]
pub struct ClipboardSegment {
    pub segment: TrackSegment,
    pub name: String,
}

/// The elements that were copied or cut, in the order of the files.
///
/// It holds the elements themselves, not references to them: they are cheap to keep (files are
/// shared, and so are the trackpoints of tracks and segments), and the clipboard stays valid
/// when the elements are changed or deleted.
#[derive(Debug, Clone)]
pub enum ClipboardContent {
    Files(Vec<Rc<File>>),
    Tracks(Vec<ClipboardTrack>),
    Segments(Vec<ClipboardSegment>),
    Waypoints(Vec<Waypoint>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ClipboardId(Uuid);

impl Default for ClipboardId {
    fn default() -> Self {
        Self(Uuid::new_v4())
    }
}

/// What was copied or cut, to be pasted, as many times as needed.
///
/// What is pasted is always the elements as they were when they were copied or cut, whatever
/// happened to them since, even if they were deleted. Pasting what was copied makes copies, with
/// new ids. What was cut is moved, with its ids, the first time it is pasted (the elements that
/// are still there are removed): the clipboard is not cut anymore after that, and the next
/// pastes make copies.
#[derive(Debug, Clone)]
pub struct Clipboard {
    id: ClipboardId,
    pub content: ClipboardContent,
    pub cut: bool,
}

/// Two clipboards are the same when they come from the same copy, and are cut the same way.
impl PartialEq for Clipboard {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id && self.cut == other.cut
    }
}

impl Clipboard {
    /// The clipboard for the selected elements, `None` if nothing is selected (or if what is
    /// selected does not exist).
    pub fn new(
        selection: &Selection,
        files: &StackEntry,
        order: &[FileId],
        cut: bool,
    ) -> Option<Clipboard> {
        let content = match selection {
            Selection::Empty => return None,
            Selection::File { file_ids } => ClipboardContent::Files(
                order
                    .iter()
                    .filter(|id| file_ids.contains(id))
                    .filter_map(|id| files.get(id).cloned())
                    .collect(),
            ),
            Selection::Track { file_id, trk_ids } => {
                let file = files.get(file_id)?;
                ClipboardContent::Tracks(
                    file.trk
                        .iter()
                        .filter(|trk| trk_ids.contains(&trk.id))
                        .map(|trk| ClipboardTrack {
                            track: trk.clone(),
                            file_name: file.info.name.clone(),
                        })
                        .collect(),
                )
            }
            Selection::TrackSegment {
                file_id,
                trk_id,
                trkseg_ids,
            } => {
                let file = files.get(file_id)?;
                let trk = file.trk.iter().find(|trk| trk.id == *trk_id)?;
                let name = trk
                    .info
                    .name
                    .clone()
                    .unwrap_or_else(|| file.info.name.clone());
                ClipboardContent::Segments(
                    trk.trkseg
                        .iter()
                        .filter(|seg| trkseg_ids.contains(&seg.id))
                        .map(|seg| ClipboardSegment {
                            segment: seg.clone(),
                            name: name.clone(),
                        })
                        .collect(),
                )
            }
            Selection::Waypoints { file_id } => ClipboardContent::Waypoints(
                files
                    .get(file_id)?
                    .wpt
                    .iter()
                    .flat_map(|chunk| chunk.wpt.iter().cloned())
                    .collect(),
            ),
            Selection::Waypoint { file_id, wpt_ids } => ClipboardContent::Waypoints(
                files
                    .get(file_id)?
                    .wpt
                    .iter()
                    .flat_map(|chunk| &chunk.wpt)
                    .filter(|wpt| wpt_ids.contains(&wpt.id))
                    .cloned()
                    .collect(),
            ),
        };
        let clipboard = Clipboard {
            id: ClipboardId::default(),
            content,
            cut,
        };
        (!clipboard.is_empty()).then_some(clipboard)
    }

    pub fn is_empty(&self) -> bool {
        match &self.content {
            ClipboardContent::Files(files) => files.is_empty(),
            ClipboardContent::Tracks(tracks) => tracks.is_empty(),
            ClipboardContent::Segments(segments) => segments.is_empty(),
            ClipboardContent::Waypoints(waypoints) => waypoints.is_empty(),
        }
    }

    /// Whether the content can be pasted when `target` is selected: files and tracks can be
    /// pasted anywhere above them in the file tree, and nothing selected stands for the list of
    /// files.
    ///
    /// | copied    | pasted when selected                     |
    /// |-----------|------------------------------------------|
    /// | files     | nothing, a file                          |
    /// | tracks    | nothing, a file, a track                 |
    /// | segments  | nothing, a file, a track, a segment      |
    /// | waypoints | a file, the waypoints, a waypoint        |
    pub fn can_paste(&self, target: &Selection) -> bool {
        use ClipboardContent as C;
        use Selection::*;
        matches!(
            (&self.content, target),
            (C::Files(_), Empty | File { .. })
                | (C::Tracks(_), Empty | File { .. } | Track { .. })
                | (
                    C::Segments(_),
                    Empty | File { .. } | Track { .. } | TrackSegment { .. }
                )
                | (
                    C::Waypoints(_),
                    File { .. } | Waypoints { .. } | Waypoint { .. }
                )
        )
    }
}

/// The ids of the elements of the content, by kind.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClipboardIds {
    Files(Vec<FileId>),
    Tracks(Vec<TrackId>),
    Segments(Vec<TrackSegmentId>),
    Waypoints(Vec<WaypointId>),
}

impl ClipboardContent {
    pub fn ids(&self) -> ClipboardIds {
        match self {
            ClipboardContent::Files(files) => {
                ClipboardIds::Files(files.iter().map(|file| file.id).collect())
            }
            ClipboardContent::Tracks(tracks) => {
                ClipboardIds::Tracks(tracks.iter().map(|trk| trk.track.id).collect())
            }
            ClipboardContent::Segments(segments) => {
                ClipboardIds::Segments(segments.iter().map(|seg| seg.segment.id).collect())
            }
            ClipboardContent::Waypoints(waypoints) => {
                ClipboardIds::Waypoints(waypoints.iter().map(|wpt| wpt.id).collect())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{TrackInfo, WaypointChunk};

    use super::*;

    /// A file with 3 tracks (named "t0", "t1", "t2") of 2 segments and 3 waypoints.
    fn file(name: &str) -> File {
        let mut file = File::default();
        file.info.name = name.to_owned();
        for i in 0..3 {
            file.trk.push(Track {
                info: TrackInfo {
                    name: (i < 2).then(|| format!("t{i}")),
                    ..Default::default()
                },
                trkseg: vec![TrackSegment::default(), TrackSegment::default()],
                ..Default::default()
            });
        }
        file.wpt.push(Rc::new(WaypointChunk {
            wpt: vec![Waypoint::default(), Waypoint::default()],
            ..Default::default()
        }));
        file.wpt.push(Rc::new(WaypointChunk {
            wpt: vec![Waypoint::default()],
            ..Default::default()
        }));
        file
    }

    fn files_of(files: Vec<File>) -> StackEntry {
        files
            .into_iter()
            .map(|file| (file.id, Rc::new(file)))
            .collect()
    }

    fn order_of(files: &StackEntry) -> Vec<FileId> {
        files.keys().copied().collect()
    }

    fn tracks(file: &File, ids: &[usize]) -> Selection {
        Selection::Track {
            file_id: file.id,
            trk_ids: ids.iter().map(|i| file.trk[*i].id).collect(),
        }
    }

    #[test]
    fn test_the_clipboard_holds_what_is_selected() {
        let file = file("source");
        let (t0, t2) = (file.trk[0].id, file.trk[2].id);
        let (s0, s1) = (file.trk[1].trkseg[0].id, file.trk[1].trkseg[1].id);
        let wpt: Vec<_> = file
            .wpt
            .iter()
            .flat_map(|c| c.wpt.iter().map(|w| w.id))
            .collect();
        let files = files_of(vec![file.clone()]);

        // tracks, in the order of the file, with the name of their file
        let clipboard =
            Clipboard::new(&tracks(&file, &[2, 0]), &files, &order_of(&files), false).unwrap();
        assert!(!clipboard.cut);
        match &clipboard.content {
            ClipboardContent::Tracks(copied) => {
                assert_eq!(
                    copied.iter().map(|c| c.track.id).collect::<Vec<_>>(),
                    vec![t0, t2]
                );
                assert!(copied.iter().all(|c| c.file_name == "source"));
            }
            other => panic!("{other:?}"),
        }

        // segments, with the name of their track, or else of their file
        let segments = |trk: usize, ids: &[TrackSegmentId]| Selection::TrackSegment {
            file_id: file.id,
            trk_id: file.trk[trk].id,
            trkseg_ids: ids.iter().copied().collect(),
        };
        match Clipboard::new(&segments(1, &[s1, s0]), &files, &order_of(&files), true)
            .unwrap()
            .content
        {
            ClipboardContent::Segments(copied) => {
                assert_eq!(
                    copied.iter().map(|c| c.segment.id).collect::<Vec<_>>(),
                    vec![s0, s1]
                );
                assert!(copied.iter().all(|c| c.name == "t1"));
            }
            other => panic!("{other:?}"),
        }
        let unnamed = file.trk[2].trkseg[0].id;
        match Clipboard::new(&segments(2, &[unnamed]), &files, &order_of(&files), true)
            .unwrap()
            .content
        {
            ClipboardContent::Segments(copied) => assert_eq!(copied[0].name, "source"),
            other => panic!("{other:?}"),
        }

        // waypoints: some of them, or all of them
        let some = Selection::Waypoint {
            file_id: file.id,
            wpt_ids: [wpt[2], wpt[0]].into(),
        };
        assert_eq!(
            Clipboard::new(&some, &files, &order_of(&files), false)
                .unwrap()
                .content
                .ids(),
            ClipboardIds::Waypoints(vec![wpt[0], wpt[2]])
        );
        assert_eq!(
            Clipboard::new(
                &Selection::Waypoints { file_id: file.id },
                &files,
                &order_of(&files),
                false
            )
            .unwrap()
            .content
            .ids(),
            ClipboardIds::Waypoints(wpt)
        );

        // files
        let selection = Selection::File {
            file_ids: [file.id].into(),
        };
        assert_eq!(
            Clipboard::new(&selection, &files, &order_of(&files), false)
                .unwrap()
                .content
                .ids(),
            ClipboardIds::Files(vec![file.id])
        );
    }

    #[test]
    fn test_nothing_to_copy() {
        let file = file("f");
        let files = files_of(vec![file.clone()]);
        assert!(Clipboard::new(&Selection::Empty, &files, &order_of(&files), false).is_none());
        // elements that do not exist
        let unknown = Selection::Track {
            file_id: FileId::default(),
            trk_ids: [TrackId::default()].into(),
        };
        assert!(Clipboard::new(&unknown, &files, &order_of(&files), false).is_none());
        let unknown = Selection::Track {
            file_id: file.id,
            trk_ids: [TrackId::default()].into(),
        };
        assert!(Clipboard::new(&unknown, &files, &order_of(&files), false).is_none());
        assert!(
            Clipboard::new(
                &Selection::File {
                    file_ids: [FileId::default()].into()
                },
                &files,
                &order_of(&files),
                false
            )
            .is_none()
        );
        // a file without waypoints
        let empty = files_of(vec![File::default()]);
        let id = *empty.keys().next().unwrap();
        assert!(
            Clipboard::new(
                &Selection::Waypoints { file_id: id },
                &empty,
                &order_of(&empty),
                true
            )
            .is_none()
        );
    }

    #[test]
    fn test_two_clipboards_are_the_same_when_they_come_from_the_same_copy() {
        let file = file("f");
        let files = files_of(vec![file.clone()]);
        let selection = tracks(&file, &[0]);
        let clipboard = Clipboard::new(&selection, &files, &order_of(&files), false).unwrap();
        assert_eq!(clipboard, clipboard.clone());
        // the same elements copied again make another clipboard
        assert_ne!(
            clipboard,
            Clipboard::new(&selection, &files, &order_of(&files), false).unwrap()
        );
        // and it is not the same once it is not cut
        let mut copy = clipboard.clone();
        copy.cut = true;
        assert_ne!(clipboard, copy);
    }

    #[test]
    fn test_the_clipboard_survives_what_happens_to_the_files() {
        let file = file("f");
        let mut files = files_of(vec![file.clone()]);
        let clipboard =
            Clipboard::new(&tracks(&file, &[0, 1]), &files, &order_of(&files), true).unwrap();
        files.clear();
        assert!(!clipboard.is_empty());
        assert_eq!(
            clipboard.content.ids(),
            ClipboardIds::Tracks(vec![file.trk[0].id, file.trk[1].id])
        );
    }

    #[test]
    fn test_where_things_can_be_pasted() {
        let file = file("f");
        let files = files_of(vec![file.clone()]);
        let selection_of = |selection: Selection| {
            Clipboard::new(&selection, &files, &order_of(&files), false).unwrap()
        };
        let file_selection = Selection::File {
            file_ids: [file.id].into(),
        };
        let track = tracks(&file, &[0]);
        let segment = Selection::TrackSegment {
            file_id: file.id,
            trk_id: file.trk[0].id,
            trkseg_ids: [file.trk[0].trkseg[0].id].into(),
        };
        let waypoints = Selection::Waypoints { file_id: file.id };
        let waypoint = Selection::Waypoint {
            file_id: file.id,
            wpt_ids: [file.wpt[0].wpt[0].id].into(),
        };
        let targets = [
            Selection::Empty,
            file_selection.clone(),
            track.clone(),
            segment.clone(),
            waypoints.clone(),
            waypoint.clone(),
        ];
        let expected = [
            // nothing, file, track, segment, waypoints, waypoint
            (file_selection, [true, true, false, false, false, false]),
            (track, [true, true, true, false, false, false]),
            (segment, [true, true, true, true, false, false]),
            (waypoints, [false, true, false, false, true, true]),
            (waypoint, [false, true, false, false, true, true]),
        ];
        for (copied, allowed) in expected {
            let clipboard = selection_of(copied.clone());
            for (target, allowed) in targets.iter().zip(allowed) {
                assert_eq!(
                    clipboard.can_paste(target),
                    allowed,
                    "{copied:?} on {target:?}"
                );
            }
        }
    }
}
