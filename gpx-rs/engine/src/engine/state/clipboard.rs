use crate::Selection;

/// What was copied or cut: the elements, by id, so that they are found again when pasting, even
/// if the files changed in between. Cut elements stay in place until they are pasted.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Clipboard {
    pub selection: Selection,
    pub cut: bool,
}

impl Clipboard {
    /// `None` if nothing is selected.
    pub fn new(selection: Selection, cut: bool) -> Option<Clipboard> {
        (selection != Selection::Empty).then_some(Clipboard { selection, cut })
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
        use Selection::*;
        matches!(
            (&self.selection, target),
            (File { .. }, Empty | File { .. })
                | (Track { .. }, Empty | File { .. } | Track { .. })
                | (
                    TrackSegment { .. },
                    Empty | File { .. } | Track { .. } | TrackSegment { .. }
                )
                | (
                    Waypoints { .. } | Waypoint { .. },
                    File { .. } | Waypoints { .. } | Waypoint { .. }
                )
        )
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, TrackId, TrackSegmentId, WaypointId};

    use super::*;

    fn file() -> Selection {
        Selection::File {
            file_ids: [FileId::default()].into(),
        }
    }

    fn track() -> Selection {
        Selection::Track {
            file_id: FileId::default(),
            trk_ids: [TrackId::default()].into(),
        }
    }

    fn segment() -> Selection {
        Selection::TrackSegment {
            file_id: FileId::default(),
            trk_id: TrackId::default(),
            trkseg_ids: [TrackSegmentId::default()].into(),
        }
    }

    fn waypoints() -> Selection {
        Selection::Waypoints {
            file_id: FileId::default(),
        }
    }

    fn waypoint() -> Selection {
        Selection::Waypoint {
            file_id: FileId::default(),
            wpt_ids: HashSet::from([WaypointId::default()]),
        }
    }

    #[test]
    fn test_nothing_to_copy() {
        assert_eq!(Clipboard::new(Selection::Empty, false), None);
        assert!(Clipboard::new(file(), true).is_some_and(|c| c.cut));
    }

    #[test]
    fn test_where_things_can_be_pasted() {
        let targets = [
            Selection::Empty,
            file(),
            track(),
            segment(),
            waypoints(),
            waypoint(),
        ];
        let expected = [
            // nothing, file, track, segment, waypoints, waypoint
            (file(), [true, true, false, false, false, false]),
            (track(), [true, true, true, false, false, false]),
            (segment(), [true, true, true, true, false, false]),
            (waypoints(), [false, true, false, false, true, true]),
            (waypoint(), [false, true, false, false, true, true]),
        ];
        for (copied, allowed) in expected {
            let clipboard = Clipboard::new(copied.clone(), false).unwrap();
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
