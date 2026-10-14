//! Reversing a path: the order of its trackpoints, and of the segments and tracks that hold them.
//!
//! The timestamps are mirrored, so that the reversed path goes through the same period of time:
//! a trackpoint at time `t` of a part that spans `start..end` ends up at `start + end - t`. When
//! the part is made of several ones (the segments of a track, the tracks of a file), the gaps
//! between them are kept: every part comes after the previous one in the new order, as late as the
//! original one came after the part that followed it.

use crate::{Track, TrackSegment, Trackpoint};

/// The time of the first trackpoint of a segment.
pub fn start_time(segment: &TrackSegment) -> Option<i64> {
    segment.iter().next().and_then(|trkpt| trkpt.time)
}

/// The time of the last trackpoint of a segment.
pub fn end_time(segment: &TrackSegment) -> Option<i64> {
    segment.last_index().and_then(|idx| segment[idx].time)
}

/// The time of the first trackpoint of a track.
pub fn track_start_time(track: &Track) -> Option<i64> {
    track.trkseg.first().and_then(start_time)
}

/// The time of the last trackpoint of a track.
pub fn track_end_time(track: &Track) -> Option<i64> {
    track.trkseg.last().and_then(end_time)
}

/// Reverses the trackpoints of a segment.
///
/// `original_next` is the time at which what came after the segment started, and `new_previous`
/// the time at which what comes before it now ends: the segment is mirrored to start there. Both
/// are those of the segment itself if the segment is reversed on its own, which are the ones
/// used when they are missing (`new_previous` is the start of the segment, and `original_next`
/// follows from the duration of the segment). Without timestamps, the trackpoints are only put
/// in the opposite order.
pub fn reverse_segment(
    segment: &mut TrackSegment,
    original_next: Option<i64>,
    new_previous: Option<i64>,
) {
    let (original_start, original_end) = (start_time(segment), end_time(segment));
    let new_previous = new_previous.or(original_start);
    let original_next = original_next.or_else(|| {
        // the segment lasts as long as before
        Some(new_previous? + original_end? - original_start?)
    });

    let len = segment.len();
    let mut points: Vec<Trackpoint> = segment.iter().cloned().collect();
    if let (Some(next), Some(previous), Some(end)) = (original_next, new_previous, original_end) {
        let new_start = previous + next - end;
        for point in points.iter_mut() {
            point.time = point.time.map(|time| new_start + (end - time));
        }
    }
    points.reverse();
    segment.splice(0, len, points);
    segment.rev_id = Default::default();
}

/// Makes a segment go back where it started: a reversed copy of it is added after its last
/// trackpoint, without the first trackpoint of the copy, which is the last one of the segment.
///
/// The timestamps of the copy go on from the end of the segment: it would start at the time of the
/// last trackpoint, and it lasts as long as the segment. Only the end of the segment changes, so
/// its other chunks stay shared.
pub fn round_trip(segment: &mut TrackSegment) {
    let len = segment.len();
    let end = end_time(segment);
    let mut back = segment.clone();
    reverse_segment(&mut back, end, end);
    segment.splice(len, len, back.iter().skip(1).cloned().collect());
    segment.rev_id = Default::default();
}

/// Reverses the segments of a track, and their trackpoints: see [`reverse_segment`] for the
/// meaning of the times, which are the ones of the track as a whole.
pub fn reverse_segments(
    segments: &mut [TrackSegment],
    original_next: Option<i64>,
    new_previous: Option<i64>,
) {
    segments.reverse();
    let (mut next, mut previous) = (original_next, new_previous);
    for segment in segments.iter_mut() {
        // the next one is the one that was before, which started here
        let original_start = start_time(segment);
        reverse_segment(segment, next, previous);
        next = original_start;
        previous = end_time(segment);
    }
}

/// Reverses the tracks of a file, and their segments and trackpoints.
pub fn reverse_tracks(tracks: &mut [Track], original_next: Option<i64>, new_previous: Option<i64>) {
    tracks.reverse();
    let (mut next, mut previous) = (original_next, new_previous);
    for track in tracks.iter_mut() {
        let original_start = track_start_time(track);
        reverse_segments(&mut track.trkseg, next, previous);
        next = original_start;
        previous = track_end_time(track);
    }
}

#[cfg(test)]
mod tests {
    use crate::LngLat;

    use super::*;

    fn segment(points: &[(f64, Option<i64>)]) -> TrackSegment {
        let mut segment = TrackSegment::default();
        let points = points
            .iter()
            .map(|(lng, time)| Trackpoint {
                coordinates: LngLat {
                    lng: *lng,
                    lat: 0.0,
                },
                time: *time,
                ..Default::default()
            })
            .collect();
        segment.splice(0, 0, points);
        segment
    }

    fn lngs(segment: &TrackSegment) -> Vec<f64> {
        segment.iter().map(|p| p.coordinates.lng).collect()
    }

    fn times(segment: &TrackSegment) -> Vec<Option<i64>> {
        segment.iter().map(|p| p.time).collect()
    }

    #[test]
    fn test_a_segment_is_mirrored_in_its_own_time_span() {
        let mut s = segment(&[(0.0, Some(0)), (1.0, Some(10)), (2.0, Some(40))]);
        let (start, end) = (start_time(&s), end_time(&s));
        reverse_segment(&mut s, end, start);
        assert_eq!(lngs(&s), [2.0, 1.0, 0.0]);
        // same span, the durations between points follow the points
        assert_eq!(times(&s), [Some(0), Some(30), Some(40)]);
    }

    #[test]
    fn test_reverse_segment_defaults() {
        // without the times around, the segment is mirrored where it is
        let mut s = segment(&[(0.0, Some(100)), (1.0, Some(130))]);
        reverse_segment(&mut s, None, None);
        assert_eq!(times(&s), [Some(100), Some(130)]);
        assert_eq!(lngs(&s), [1.0, 0.0]);
    }

    #[test]
    fn test_a_segment_without_times_is_only_reversed() {
        let mut s = segment(&[(0.0, None), (1.0, None), (2.0, None)]);
        reverse_segment(&mut s, None, None);
        assert_eq!(lngs(&s), [2.0, 1.0, 0.0]);
        assert_eq!(times(&s), [None, None, None]);
    }

    #[test]
    fn test_round_trip_goes_back_in_time_from_the_end() {
        let mut s = segment(&[(0.0, Some(0)), (1.0, Some(10)), (2.0, Some(40))]);
        let first = s.rev_id;
        round_trip(&mut s);
        assert_ne!(s.rev_id, first);
        // the last trackpoint is the turning point, it is not repeated
        assert_eq!(lngs(&s), [0.0, 1.0, 2.0, 1.0, 0.0]);
        // the way back lasts as long as the way there, and starts when it ended
        assert_eq!(times(&s), [Some(0), Some(10), Some(40), Some(70), Some(80)]);
        // and it is a segment whose ends are anchors
        assert_eq!(s[0].anchor, Some(0));
        assert_eq!(s[4].anchor, Some(0));
    }

    #[test]
    fn test_round_trip_without_times() {
        let mut s = segment(&[(0.0, None), (1.0, None)]);
        round_trip(&mut s);
        assert_eq!(lngs(&s), [0.0, 1.0, 0.0]);
        assert_eq!(times(&s), [None; 3]);
    }

    #[test]
    fn test_segments_keep_the_gaps_between_them() {
        // 0..20, then 100..120: a gap of 80
        let mut segments = vec![
            segment(&[(0.0, Some(0)), (1.0, Some(10)), (2.0, Some(20))]),
            segment(&[(3.0, Some(100)), (4.0, Some(110)), (5.0, Some(120))]),
        ];
        let (end, start) = (end_time(&segments[1]), start_time(&segments[0]));
        reverse_segments(&mut segments, end, start);
        assert_eq!(lngs(&segments[0]), [5.0, 4.0, 3.0]);
        assert_eq!(lngs(&segments[1]), [2.0, 1.0, 0.0]);
        assert_eq!(times(&segments[0]), [Some(0), Some(10), Some(20)]);
        // the gap is still 80
        assert_eq!(times(&segments[1]), [Some(100), Some(110), Some(120)]);
    }

    #[test]
    fn test_tracks_are_reversed_like_segments() {
        let track = |segments: Vec<TrackSegment>| Track {
            trkseg: segments,
            ..Default::default()
        };
        let mut tracks = vec![
            track(vec![
                segment(&[(0.0, Some(0)), (1.0, Some(10))]),
                segment(&[(2.0, Some(50)), (3.0, Some(60))]),
            ]),
            track(vec![segment(&[(4.0, Some(200)), (5.0, Some(230))])]),
        ];
        let (end, start) = (track_end_time(&tracks[1]), track_start_time(&tracks[0]));
        reverse_tracks(&mut tracks, end, start);
        let all: Vec<f64> = tracks
            .iter()
            .flat_map(|t| t.trkseg.iter().flat_map(lngs))
            .collect();
        assert_eq!(all, [5.0, 4.0, 3.0, 2.0, 1.0, 0.0]);
        // 3 segments: durations 10, 10, 30 and gaps 40 and 140 are reversed to 30, 10, 10 and
        // gaps 140 and 40 (the first part of the time is the longest)
        assert_eq!(times(&tracks[0].trkseg[0]), [Some(0), Some(30)]);
        assert_eq!(times(&tracks[1].trkseg[0]), [Some(170), Some(180)]);
        assert_eq!(times(&tracks[1].trkseg[1]), [Some(220), Some(230)]);
    }
}
