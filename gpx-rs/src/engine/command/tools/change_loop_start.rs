use std::rc::Rc;

use crate::{Apply, CommandError, State, Trackpoint, replace_trackpoints};

use super::route::find_target;

/// Makes the trackpoint `index` of the selection (see `RoutingBuffer`) the start of its segment,
/// which is a loop: the trackpoints before it, and itself, are copied after the last trackpoint
/// of the segment, and the original ones are removed. The trackpoint is both the first and the
/// last one, which closes the loop on it.
///
/// The copies keep their durations, and start one second after the previous last trackpoint if
/// the segment has timestamps (see [`replace_trackpoints`]).
///
/// It is how the routing tool starts a loop somewhere else. The first and last trackpoints are
/// anchors shown at every zoom level, as any end of a segment.
#[derive(Debug)]
pub struct ChangeLoopStart {
    pub index: u32,
}

impl Apply for ChangeLoopStart {
    fn apply(self, state: &mut State) -> Result<(), CommandError> {
        let index = self.index as usize;
        let target = find_target(state, index, index)?.ok_or(CommandError::NothingToDo)?;
        let mut file = (*state.files[&target.location.file_id]).clone();
        let segment = &mut file.trk[target.location.trk].trkseg[target.location.seg];
        let (start, len) = (target.start, segment.len());
        if start == 0 || start >= len {
            // it already is the start, or it is not a trackpoint
            return Err(CommandError::NothingToDo);
        }

        // the trackpoint itself ends the loop as well
        let moved: Vec<Trackpoint> = segment.iter().take(start + 1).cloned().collect();
        // the copies are shifted after the last trackpoint, which is all that matters of the rest
        let mut tail = vec![segment[len - 1].clone()];
        replace_trackpoints(&mut tail, 1, 1, moved, None, None, false);
        tail.remove(0);

        // only the chunks at the ends of the segment change: the others stay shared
        segment.splice(len, len, tail);
        segment.splice(0, start, vec![]);
        segment.rev_id = Default::default();
        state.files.insert(target.location.file_id, Rc::new(file));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use crate::{FileId, Load, Selection, TrackSegment, engine::command::fixture::Fixture};

    use super::*;

    fn loaded(path: &str) -> (Fixture, FileId) {
        let mut fx = Fixture::default();
        let data = std::fs::read(path).unwrap();
        Load {
            data: &data,
            name: "file",
        }
        .apply(&mut fx.state())
        .unwrap();
        let id = fx.order.0[0];
        fx.selection = Selection::File {
            file_ids: HashSet::from([id]),
        };
        (fx, id)
    }

    fn first_segment(fx: &Fixture, id: FileId) -> TrackSegment {
        fx.files[&id].trk[0].trkseg[0].clone()
    }

    #[test]
    fn test_the_points_before_move_to_the_end_and_the_loop_closes_on_the_start() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = first_segment(&fx, id);
        let n = before.len();
        assert!(n > 10);

        ChangeLoopStart { index: 4 }.apply(&mut fx.state()).unwrap();
        let after = first_segment(&fx, id);
        // the trackpoint is repeated at the end
        assert_eq!(after.len(), n + 1);
        assert_ne!(after.rev_id, before.rev_id);
        let lng = |s: &TrackSegment, i: usize| s[i].coordinates.lng;
        for i in 0..=n {
            assert_eq!(lng(&after, i), lng(&before, (i + 4) % n), "{i}");
        }
        assert_eq!(lng(&after, n), lng(&after, 0));
        // the start and the end of the new segment are anchors, whatever they were
        assert_eq!(after[0].anchor, Some(0));
        assert_eq!(after[n].anchor, Some(0));
    }

    #[test]
    fn test_the_moved_part_is_shifted_after_the_last_point() {
        let (mut fx, id) = loaded("data/with_time.gpx");
        let before = first_segment(&fx, id);
        let n = before.len();
        ChangeLoopStart { index: 30 }
            .apply(&mut fx.state())
            .unwrap();
        let after = first_segment(&fx, id);
        assert_eq!(after.len(), n + 1);
        let times: Vec<_> = after.iter().map(|p| p.time.unwrap()).collect();
        assert!(times.windows(2).all(|w| w[0] < w[1]), "{times:?}");
        // the part that was after the index is untouched
        for i in 0..n - 30 {
            assert_eq!(after[i].time, before[30 + i].time);
        }
        // the copies follow the last point by a second, and keep their durations
        let last = before[n - 1].time.unwrap();
        assert_eq!(after[n - 30].time, Some(last + 1000));
        for i in n - 30..n {
            let original = i - (n - 30);
            assert_eq!(
                after[i + 1].time.unwrap() - after[i].time.unwrap(),
                before[original + 1].time.unwrap() - before[original].time.unwrap(),
                "{i}"
            );
        }
    }

    #[test]
    fn test_nothing_to_do_on_the_start_or_out_of_the_trackpoints() {
        let (mut fx, id) = loaded("data/simple.gpx");
        let before = fx.files[&id].clone();
        assert_eq!(
            ChangeLoopStart { index: 0 }.apply(&mut fx.state()),
            Err(CommandError::NothingToDo)
        );
        let total = first_segment(&fx, id).len() as u32;
        assert!(matches!(
            ChangeLoopStart { index: total + 5 }.apply(&mut fx.state()),
            Err(CommandError::InvalidData(_))
        ));
        assert!(Rc::ptr_eq(&fx.files[&id], &before));
    }
}
