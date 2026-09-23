use crate::gpx::{TrackSegment, TrackSegmentIndex};

pub fn ramer_douglas_peucker<F, T>(
    trkseg: &TrackSegment,
    distance: &F,
    epsilon: T,
) -> Vec<TrackSegmentIndex>
where
    F: Fn(TrackSegmentIndex, TrackSegmentIndex, TrackSegmentIndex) -> T,
    T: Default + PartialOrd + Copy,
{
    match trkseg.len() {
        0 => vec![],
        1 => vec![trkseg.first_index().unwrap()],
        2 => vec![trkseg.last_index().unwrap()],
        _ => {
            let first = trkseg.first_index().unwrap();
            let last = trkseg.last_index().unwrap();

            let mut indices = vec![first];
            ramer_douglas_peucker_helper(trkseg, first, last, distance, epsilon, &mut indices);
            indices.push(last);
            indices
        }
    }
}

fn ramer_douglas_peucker_helper<F, T>(
    trkseg: &TrackSegment,
    start: TrackSegmentIndex,
    end: TrackSegmentIndex,
    distance: &F,
    epsilon: T,
    indices: &mut Vec<TrackSegmentIndex>,
) where
    F: Fn(TrackSegmentIndex, TrackSegmentIndex, TrackSegmentIndex) -> T,
    T: Default + PartialOrd + Copy,
{
    let mut max_idx = None;
    let mut max_dist = T::default();

    let mut cur = trkseg.next_index(Some(start));

    while let Some(idx) = cur {
        if idx == end {
            break;
        }

        let dist = distance(start, end, idx);
        if dist > max_dist {
            max_idx = Some(idx);
            max_dist = dist;
        }

        cur = trkseg.next_index(cur);
    }

    if let Some(idx) = max_idx {
        if max_dist > epsilon {
            ramer_douglas_peucker_helper(trkseg, start, idx, distance, epsilon, indices);
            indices.push(idx);
            ramer_douglas_peucker_helper(trkseg, idx, end, distance, epsilon, indices);
        }
    }
}
