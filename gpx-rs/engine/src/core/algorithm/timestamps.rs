use crate::{Trackpoint, distance};

/// Replaces the trackpoints `start..end` of `trkpt` by `points`, keeping the timestamps of the
/// whole path consistent. It is the work of the old `replaceTrackPoints` of the TS library.
///
/// The timestamps only matter if the path has some, or if `speed` (in km/h) is given: then the
/// new points that have none get some (a trackpoint after the previous one at `speed`, or one
/// second after it without a speed), and so do the points before or after the range if they
/// had none. `start_time` is the time of the first trackpoint when nothing else gives it.
/// New points that have timestamps are shifted if they are too early to follow the previous
/// trackpoint, and so are the points after the range. With `remove_gaps`, the new points are
/// also brought closer to the previous trackpoint if they come long after it.
///
/// Panics if `start..end` is not inside `trkpt`.
pub fn replace_trackpoints(
    trkpt: &mut Vec<Trackpoint>,
    start: usize,
    end: usize,
    mut points: Vec<Trackpoint>,
    speed: Option<f64>,
    start_time: Option<i64>,
    remove_gaps: bool,
) {
    assert!(start <= end && end <= trkpt.len());
    let has_times = trkpt.first().is_some_and(|first| first.time.is_some());

    if speed.is_some() || has_times {
        if start > 0 && trkpt[0].time.is_none() {
            // the points before the range have no timestamps
            let before: Vec<_> = trkpt.drain(..start).collect();
            trkpt.splice(0..0, with_timestamps(before, speed, None, start_time));
        }

        if !points.is_empty() {
            let last = start.checked_sub(1).map(|i| &trkpt[i]);
            let missing =
                points[0].time.is_none() || points.get(1).is_some_and(|p| p.time.is_none());
            if missing {
                points = with_timestamps(points, speed, last, start_time);
            } else if let Some(last) = last {
                if is_before(points[0].time, last.time) {
                    // too early
                    points = shifted_and_compressed(points, speed, 1.0, last);
                } else if remove_gaps {
                    if same_place(&points[0], last) {
                        // the same place: the new points start at the previous trackpoint, which
                        // is the new first one
                        if is_before(last.time, points[0].time) {
                            points = shifted_and_compressed(points, speed, 1.0, last);
                            points.remove(0);
                        }
                    } else if matches!((points[0].time, last.time), (Some(new), Some(old)) if new - old > 1000)
                    {
                        // another place: the new points start one second after the previous one
                        let mut artificial_last = points[0].clone();
                        artificial_last.time = last.time.map(|time| time + 1000);
                        points = shifted_and_compressed(points, speed, 1.0, &artificial_last);
                    }
                }
            }
        }

        if end < trkpt.len() {
            // the points after the range
            let last = points
                .last()
                .or_else(|| start.checked_sub(1).map(|i| &trkpt[i]))
                .cloned();
            if trkpt[end].time.is_none() {
                let after: Vec<_> = trkpt.drain(end..).collect();
                let after = with_timestamps(after, speed, last.as_ref(), start_time);
                trkpt.extend(after);
            } else if let Some(last) = last
                && is_before(trkpt[end].time, last.time)
            {
                let after: Vec<_> = trkpt.drain(end..).collect();
                trkpt.extend(shifted_and_compressed(after, speed, 1.0, &last));
            }
        }
    }

    trkpt.splice(start..end, points);
}

/// How long each interval between two consecutive trackpoints of a segment should last, relative
/// to the others, for a made-up pace: the longer the interval, and the steeper it goes up, the
/// longer. `slopes` has the slope (in %) at each trackpoint.
pub fn artificial_weights(points: &[Trackpoint], slopes: &[f64]) -> Vec<f64> {
    points
        .windows(2)
        .zip(slopes)
        .map(|(pair, slope)| {
            let km = distance(pair[0].coordinates, pair[1].coordinates);
            km * (0.5 + 1.0 / (1.0 + (-0.2 * slope).exp()))
        })
        .collect()
}

/// `points` with made-up timestamps: the first one is at `start`, and each next one follows the
/// previous one after `weights[i]` times `ms_per_weight` milliseconds (see [`artificial_weights`]).
pub fn with_artificial_timestamps(
    mut points: Vec<Trackpoint>,
    weights: &[f64],
    ms_per_weight: f64,
    start: i64,
) -> Vec<Trackpoint> {
    let mut elapsed = 0.0;
    for (i, point) in points.iter_mut().enumerate() {
        if i > 0 {
            elapsed += weights[i - 1] * ms_per_weight;
        }
        point.time = Some(start + elapsed as i64);
    }
    points
}

fn same_place(a: &Trackpoint, b: &Trackpoint) -> bool {
    a.coordinates.lng == b.coordinates.lng && a.coordinates.lat == b.coordinates.lat
}

/// Whether both times are known and `a` is before `b`.
fn is_before(a: Option<i64>, b: Option<i64>) -> bool {
    matches!((a, b), (Some(a), Some(b)) if a < b)
}

/// The time at which `b` is reached after `a`, at `speed` km/h: one second later without a
/// speed, unknown if `a` has no time.
///
/// The old code gave an invalid date for a null or negative speed: it is as if there was none.
fn timestamp_after(a: &Trackpoint, b: &Trackpoint, speed: Option<f64>) -> Option<i64> {
    let time = a.time?;
    match speed.filter(|speed| speed.is_finite() && *speed > 0.0) {
        None => Some(time + 1000),
        Some(speed) => {
            let km = distance(a.coordinates, b.coordinates);
            Some(time + (3_600_000.0 * km / speed) as i64)
        }
    }
}

/// `points` with the timestamps that follow `last` (the trackpoint before them), one after the
/// other. Without `last`, the first one is at `start_time`.
///
/// Unlike the old code, a `last` without a time does not get `start_time` itself, only the copy
/// used here.
pub fn with_timestamps(
    points: Vec<Trackpoint>,
    speed: Option<f64>,
    last: Option<&Trackpoint>,
    start_time: Option<i64>,
) -> Vec<Trackpoint> {
    let Some(first) = points.first() else {
        return points;
    };
    let mut last = match last {
        Some(last) if last.time.is_some() => last.clone(),
        other => {
            let mut last = other.unwrap_or(first).clone();
            last.time = start_time;
            last
        }
    };
    points
        .into_iter()
        .map(|mut point| {
            point.time = timestamp_after(&last, &point, speed);
            last = point.clone();
            point
        })
        .collect()
}

/// `points` with their timestamps moved so that the first one follows `last`, and their durations
/// multiplied by `ratio`. The ones that have no timestamp follow the previous one, as in
/// [`with_timestamps`]. Without a time for `last`, or for the first point, none is known.
pub fn shifted_and_compressed(
    points: Vec<Trackpoint>,
    speed: Option<f64>,
    ratio: f64,
    last: &Trackpoint,
) -> Vec<Trackpoint> {
    let Some(first) = points.first() else {
        return points;
    };
    let start = timestamp_after(last, first, speed);
    let first_time = first.time;
    let mut previous = first.clone();
    points
        .into_iter()
        .map(|point| {
            let mut shifted = point.clone();
            shifted.time = match point.time {
                None => timestamp_after(&previous, &point, speed),
                Some(time) => start
                    .zip(first_time)
                    .map(|(start, first)| start + (ratio * (time - first) as f64) as i64),
            };
            previous = shifted.clone();
            shifted
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::LngLat;

    use super::*;

    /// A point every 1 km along the equator... about, at 0.009 degrees of longitude.
    fn point(i: usize, time: Option<i64>) -> Trackpoint {
        Trackpoint {
            coordinates: LngLat {
                lng: i as f64 * 0.009,
                lat: 0.0,
            },
            time,
            ..Default::default()
        }
    }

    fn timed(range: std::ops::Range<usize>, start: i64, step: i64) -> Vec<Trackpoint> {
        range
            .map(|i| point(i, Some(start + step * i as i64)))
            .collect()
    }

    fn untimed(range: std::ops::Range<usize>) -> Vec<Trackpoint> {
        range.map(|i| point(i, None)).collect()
    }

    fn times(trkpt: &[Trackpoint]) -> Vec<Option<i64>> {
        trkpt.iter().map(|p| p.time).collect()
    }

    #[test]
    fn test_without_times_nor_speed_it_is_a_splice() {
        let mut trkpt = untimed(0..5);
        replace_trackpoints(&mut trkpt, 1, 3, untimed(10..13), None, None, false);
        assert_eq!(trkpt.len(), 6);
        assert!(trkpt.iter().all(|p| p.time.is_none()));
        assert_eq!(trkpt[1].coordinates.lng, point(10, None).coordinates.lng);
        assert_eq!(trkpt[4].coordinates.lng, point(3, None).coordinates.lng);
    }

    #[test]
    fn test_new_points_follow_the_previous_one_at_the_speed() {
        // 1 km in 10 s is 360 km/h
        let mut trkpt = timed(0..4, 0, 10_000);
        let km = distance(point(0, None).coordinates, point(1, None).coordinates);
        let speed = Some(36.0 * km / 0.01); // the time of 1 point to the next is 100 s
        replace_trackpoints(&mut trkpt, 2, 3, untimed(2..4), speed, None, false);
        let expected = 10_000 + (3_600_000.0 * km / speed.unwrap()) as i64;
        assert_eq!(trkpt[2].time, Some(expected));
        assert!(trkpt[2].time > trkpt[1].time);
        // the points after follow the new ones, they were not too early
        assert_eq!(trkpt.len(), 5);
        assert_eq!(trkpt[4].time, Some(30_000));
    }

    #[test]
    fn test_without_a_speed_new_points_are_one_second_apart() {
        let mut trkpt = timed(0..3, 5_000, 60_000);
        replace_trackpoints(&mut trkpt, 1, 2, untimed(10..13), None, None, false);
        assert_eq!(
            times(&trkpt[..4]),
            [Some(5_000), Some(6_000), Some(7_000), Some(8_000)]
        );
        // what comes after was after, it is kept
        assert_eq!(trkpt[4].time, Some(125_000));
    }

    #[test]
    fn test_the_points_after_are_shifted_if_they_are_too_early() {
        let mut trkpt = timed(0..4, 0, 10_000);
        // 30 new points, one second apart: the last one is at 30 s, but the next original
        // trackpoint is at 20 s
        replace_trackpoints(&mut trkpt, 1, 2, untimed(10..40), None, None, false);
        assert_eq!(trkpt.len(), 33);
        assert_eq!(trkpt[1].time, Some(1_000));
        assert_eq!(trkpt[30].time, Some(30_000));
        // the following points keep the duration between them, after the new ones
        assert_eq!(trkpt[31].time, Some(31_000));
        assert_eq!(trkpt[32].time, Some(41_000));
    }

    #[test]
    fn test_a_path_without_times_gets_them_from_the_speed_and_start_time() {
        let mut trkpt = untimed(0..4);
        replace_trackpoints(
            &mut trkpt,
            3,
            4,
            untimed(3..6),
            Some(10.0),
            Some(1_000),
            false,
        );
        let times: Vec<_> = times(&trkpt);
        assert_eq!(times[0], Some(1_000));
        assert!(times.iter().all(Option::is_some));
        assert!(times.windows(2).all(|w| w[0].unwrap() < w[1].unwrap()));
    }

    #[test]
    fn test_an_unusable_speed_is_as_if_there_was_none() {
        for speed in [0.0, -5.0, f64::NAN, f64::INFINITY] {
            let mut trkpt = timed(0..2, 0, 10_000);
            replace_trackpoints(&mut trkpt, 2, 2, untimed(2..4), Some(speed), None, false);
            assert_eq!(
                times(&trkpt),
                [Some(0), Some(10_000), Some(11_000), Some(12_000)],
                "{speed}"
            );
        }
    }

    #[test]
    fn test_new_points_with_times_that_are_too_early_are_shifted() {
        let mut trkpt = timed(0..3, 100_000, 10_000);
        // they are at 0, 5 s: they are moved to follow the trackpoint at 110 s
        let new = vec![point(5, Some(0)), point(6, Some(5_000))];
        replace_trackpoints(&mut trkpt, 2, 3, new, None, None, false);
        // they follow the previous trackpoint after one second, keeping their own durations
        assert_eq!(trkpt[2].time, Some(111_000));
        assert_eq!(trkpt[3].time, Some(116_000));
    }

    #[test]
    fn test_remove_gaps_at_the_same_place_and_elsewhere() {
        // same place: the first new point is the previous trackpoint
        let mut trkpt = timed(0..3, 0, 10_000);
        let new = vec![point(2, Some(500_000)), point(3, Some(510_000))];
        replace_trackpoints(&mut trkpt, 3, 3, new.clone(), None, None, true);
        assert_eq!(trkpt.len(), 4);
        // without a speed, it is one second after the previous trackpoint, not at its time
        assert_eq!(trkpt[3].time, Some(31_000));
        // with a speed, the distance is zero
        let mut trkpt = timed(0..3, 0, 10_000);
        replace_trackpoints(&mut trkpt, 3, 3, new, Some(10.0), None, true);
        assert_eq!(trkpt[3].time, Some(30_000));

        // another place: one second after the previous one
        let mut trkpt = timed(0..3, 0, 10_000);
        let new = vec![point(5, Some(500_000)), point(6, Some(510_000))];
        replace_trackpoints(&mut trkpt, 3, 3, new, None, None, true);
        assert_eq!(trkpt.len(), 5);
        // the old code adds the second twice with no speed, see `timestamp_after`
        assert_eq!(trkpt[3].time, Some(22_000));
        assert_eq!(trkpt[4].time, Some(32_000));

        // without removing the gaps they stay
        let mut trkpt = timed(0..3, 0, 10_000);
        let new = vec![point(5, Some(500_000)), point(6, Some(510_000))];
        replace_trackpoints(&mut trkpt, 3, 3, new, None, None, false);
        assert_eq!(trkpt[3].time, Some(500_000));
    }

    #[test]
    fn test_removing_points_adapts_nothing_if_the_next_one_is_after() {
        let mut trkpt = timed(0..5, 0, 10_000);
        replace_trackpoints(&mut trkpt, 1, 3, vec![], None, None, false);
        assert_eq!(times(&trkpt), [Some(0), Some(30_000), Some(40_000)]);
        // from the beginning
        replace_trackpoints(&mut trkpt, 0, 2, vec![], None, None, false);
        assert_eq!(times(&trkpt), [Some(40_000)]);
        replace_trackpoints(&mut trkpt, 0, 1, vec![], None, None, false);
        assert!(trkpt.is_empty());
    }

    #[test]
    fn test_points_without_a_known_previous_time_get_none() {
        // nothing gives a time to start with
        let mut trkpt = untimed(0..2);
        replace_trackpoints(&mut trkpt, 2, 2, untimed(2..4), Some(10.0), None, false);
        assert!(trkpt.iter().all(|p| p.time.is_none()));
    }
}
