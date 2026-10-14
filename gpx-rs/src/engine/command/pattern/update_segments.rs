use std::collections::HashMap;
use std::rc::Rc;

use crate::{File, FileId, SegmentLocation, State, TrackSegment};

/// Edits the segments at `locations`, calling `f` with the position of each location in the slice
/// and its segment, in that order.
///
/// Each file concerned is copied once (cheap, trackpoints are shared chunks) and stored back as a
/// new snapshot. The segments take care of their own revision (see [`TrackSegment`]).
pub fn update_segments(
    state: &mut State,
    locations: &[SegmentLocation],
    mut f: impl FnMut(usize, &mut TrackSegment),
) {
    let mut files: HashMap<FileId, File> = HashMap::new();
    for (i, location) in locations.iter().enumerate() {
        let file = files
            .entry(location.file_id)
            .or_insert_with(|| (*state.files[&location.file_id]).clone());
        f(i, &mut file.trk[location.trk].trkseg[location.seg]);
    }
    for (file_id, file) in files {
        state.files.insert(file_id, Rc::new(file));
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use crate::engine::command::fixture::Fixture;

    use super::*;

    fn fixture() -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read("data/with_tracks_and_segments.gpx").unwrap();
        let file = Rc::new(crate::parse(&data, &mut Default::default()).unwrap());
        let id = file.id;
        fx.files.insert(id, file);
        (fx, id)
    }

    #[test]
    fn test_only_the_given_segments_are_edited_in_order() {
        let (mut fx, id) = fixture();
        let before = fx.files[&id].clone();
        let locations = [
            SegmentLocation {
                file_id: id,
                trk: 1,
                seg: 0,
            },
            SegmentLocation {
                file_id: id,
                trk: 0,
                seg: 0,
            },
        ];
        let mut calls = vec![];
        update_segments(&mut fx.state(), &locations, |i, segment| {
            calls.push(i);
            segment.update(0, |trkpt| trkpt.ele = 1234.0);
        });

        assert_eq!(calls, vec![0, 1]);
        let after = &fx.files[&id];
        assert!(!Rc::ptr_eq(after, &before));
        for (trk, seg) in [(1, 0), (0, 0)] {
            assert_eq!(after.trk[trk].trkseg[seg][0].ele, 1234.0);
            assert_ne!(
                after.trk[trk].trkseg[seg].rev_id,
                before.trk[trk].trkseg[seg].rev_id
            );
        }
        // the other segments are the same ones
        assert_eq!(
            after.trk[0].trkseg[1].rev_id,
            before.trk[0].trkseg[1].rev_id
        );
    }

    #[test]
    fn test_no_location_leaves_the_files_alone() {
        let (mut fx, id) = fixture();
        let before = fx.files[&id].clone();
        update_segments(&mut fx.state(), &[], |_, _| panic!("nothing to edit"));
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
