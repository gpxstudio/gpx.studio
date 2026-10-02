use crate::{
    gpx::{TrackSegment, TrackSegmentIndex},
    utils::crossarc,
};

pub fn ramer_douglas_peucker<F>(
    trkseg: &TrackSegment,
    mapping: &F,
    epsilon: f64,
) -> Vec<TrackSegmentIndex>
where
    F: Fn(TrackSegmentIndex) -> (f64, f64),
{
    match trkseg.len() {
        0 => vec![],
        1 => vec![trkseg.first_index().unwrap()],
        2 => vec![trkseg.last_index().unwrap()],
        _ => {
            let first = trkseg.first_index().unwrap();
            let last = trkseg.last_index().unwrap();

            let mut indices = vec![first];
            ramer_douglas_peucker_helper(trkseg, first, last, mapping, epsilon, &mut indices);
            indices.push(last);
            indices
        }
    }
}

fn ramer_douglas_peucker_helper<F>(
    trkseg: &TrackSegment,
    start: TrackSegmentIndex,
    end: TrackSegmentIndex,
    mapping: &F,
    epsilon: f64,
    indices: &mut Vec<TrackSegmentIndex>,
) where
    F: Fn(TrackSegmentIndex) -> (f64, f64),
{
    let mut max_idx = None;
    let mut max_dist = 0.0;

    let start_pt = mapping(start);
    let end_pt = mapping(end);

    let mut cur = trkseg.next_index(Some(start));
    while let Some(idx) = cur {
        if idx == end {
            break;
        }

        let pt = mapping(idx);
        let dist = crossarc(start_pt.0, start_pt.1, end_pt.0, end_pt.1, pt.0, pt.1);
        if dist > max_dist {
            max_idx = Some(idx);
            max_dist = dist;
        }

        cur = trkseg.next_index(cur);
    }

    if let Some(idx) = max_idx {
        if max_dist > epsilon {
            ramer_douglas_peucker_helper(trkseg, start, idx, mapping, epsilon, indices);
            indices.push(idx);
            ramer_douglas_peucker_helper(trkseg, idx, end, mapping, epsilon, indices);
        }
    }
}
