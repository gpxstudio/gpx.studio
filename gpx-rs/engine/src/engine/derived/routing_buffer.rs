use crate::{FileId, Selection, StackEntry, TrackSegmentId, TrackSegmentRevisionId};

/// What the routing tool needs about the selected segments (see
/// [`Selection::segment_locations`]): where their anchors are among their trackpoints.
///
/// Trackpoints are numbered like in the [`crate::StatisticsBuffer`], over all the selected
/// segments one after the other, except that the segments that are not covered by the routing
/// tool (waypoints) are left out.
#[derive(Debug, Default)]
pub struct RoutingBuffer {
    /// The index of each anchor in the selection, in order. The first and last trackpoints of a
    /// segment always are anchors.
    pub anchor_indices: Vec<u32>,
    /// The lowest map zoom level at which each anchor is shown.
    pub anchor_zooms: Vec<u8>,
    /// Index in the selection of the first trackpoint of each selected segment that has some,
    /// which tells which segment an anchor or a trackpoint belongs to.
    pub segment_starts: Vec<u32>,
    /// Id of each selected segment that has trackpoints, as `segment_starts`.
    pub segment_ids: Vec<TrackSegmentId>,
    /// Changes when the selected segments, or their trackpoints, change. Commands that refer to
    /// trackpoints by their index in the selection carry it, to be refused if the selection is
    /// not the one the indices were taken from anymore.
    pub revision: u32,
    /// What the revision stands for.
    signature: Vec<(TrackSegmentId, TrackSegmentRevisionId)>,
}

impl RoutingBuffer {
    pub fn update(&mut self, files: Option<&StackEntry>, selection: &Selection, order: &[FileId]) {
        self.anchor_indices.clear();
        self.anchor_zooms.clear();
        self.segment_starts.clear();
        self.segment_ids.clear();

        let mut signature = vec![];
        let mut index = 0;
        for location in files
            .map(|files| selection.segment_locations(files, order))
            .unwrap_or_default()
        {
            let segment = &files.unwrap()[&location.file_id].trk[location.trk].trkseg[location.seg];
            signature.push((segment.id, segment.rev_id));
            if segment.is_empty() {
                continue;
            }
            self.segment_starts.push(index as u32);
            self.segment_ids.push(segment.id);
            for trkpt in segment.iter() {
                if let Some(zoom) = trkpt.anchor {
                    self.anchor_indices.push(index as u32);
                    self.anchor_zooms.push(zoom);
                }
                index += 1;
            }
        }

        if signature != self.signature {
            self.revision = self.revision.wrapping_add(1);
            self.signature = signature;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::HashSet, rc::Rc};

    use crate::parse;

    use super::*;

    fn loaded() -> (StackEntry, FileId) {
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        let file = parse(&data, &mut Default::default()).unwrap();
        let id = file.id;
        let mut files = StackEntry::default();
        files.insert(id, Rc::new(file));
        (files, id)
    }

    fn file_selection(id: FileId) -> Selection {
        Selection::File {
            file_ids: HashSet::from([id]),
        }
    }

    #[test]
    fn test_anchors_and_starts_follow_the_selected_segments() {
        let (files, id) = loaded();
        let lengths: Vec<usize> = files[&id]
            .trk
            .iter()
            .flat_map(|trk| trk.trkseg.iter().map(|segment| segment.len()))
            .collect();
        let mut buffer = RoutingBuffer::default();
        buffer.update(Some(&files), &file_selection(id), &[id]);

        // an empty segment has no start
        assert_eq!(buffer.segment_ids.len(), buffer.segment_starts.len());
        let mut start = 0;
        let expected: Vec<u32> = lengths
            .iter()
            .filter(|len| **len > 0)
            .map(|len| {
                start += len;
                (start - len) as u32
            })
            .collect();
        assert_eq!(buffer.segment_starts, expected);
        // the ends of the segments are always anchors, shown at every zoom level
        assert_eq!(buffer.anchor_indices.len(), buffer.anchor_zooms.len());
        assert!(buffer.anchor_indices.windows(2).all(|w| w[0] < w[1]));
        let total: usize = lengths.iter().sum();
        let ends = expected
            .iter()
            .copied()
            .chain(expected.iter().skip(1).map(|start| start - 1))
            .chain([total as u32 - 1]);
        for end in ends {
            let position = buffer.anchor_indices.iter().position(|i| *i == end);
            assert_eq!(position.map(|p| buffer.anchor_zooms[p]), Some(0), "{end}");
        }
    }

    #[test]
    fn test_nothing_without_segments() {
        let (files, id) = loaded();
        let mut buffer = RoutingBuffer::default();
        buffer.update(Some(&files), &Selection::Empty, &[id]);
        assert!(buffer.anchor_indices.is_empty() && buffer.segment_starts.is_empty());
        // waypoints are not covered by the routing tool
        buffer.update(Some(&files), &Selection::Waypoints { file_id: id }, &[id]);
        assert!(buffer.anchor_indices.is_empty() && buffer.segment_starts.is_empty());
        buffer.update(None, &file_selection(id), &[id]);
        assert!(buffer.anchor_indices.is_empty() && buffer.segment_starts.is_empty());
    }

    #[test]
    fn test_revision_changes_with_the_selected_segments() {
        let (mut files, id) = loaded();
        let mut buffer = RoutingBuffer::default();
        buffer.update(Some(&files), &file_selection(id), &[id]);
        let first = buffer.revision;

        // the same segments: the indices still mean the same trackpoints
        buffer.update(Some(&files), &file_selection(id), &[id]);
        assert_eq!(buffer.revision, first);

        // other trackpoints in the same segment
        let mut file = (*files[&id]).clone();
        file.trk[0].trkseg[0].rev_id = Default::default();
        files.insert(id, Rc::new(file));
        buffer.update(Some(&files), &file_selection(id), &[id]);
        assert_ne!(buffer.revision, first);
        let second = buffer.revision;

        // another selection
        buffer.update(Some(&files), &Selection::Empty, &[id]);
        assert_ne!(buffer.revision, second);
    }
}
