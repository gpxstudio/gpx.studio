use crate::{
    core::gpx::{TrackSegment, TrackSegmentIndex},
    core::utils::crossarc,
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
        2 => vec![trkseg.first_index().unwrap(), trkseg.last_index().unwrap()],
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

#[cfg(test)]
mod tests {
    use crate::{Trackpoint, TrackpointChunk};

    use super::*;

    fn segment(eles: &[f64]) -> TrackSegment {
        let mut trkseg = TrackSegment::default();
        // several small chunks, to also exercise the chunk boundaries
        for part in eles.chunks(3) {
            let mut chunk = TrackpointChunk::default();
            for ele in part {
                chunk.trkpt.push(Trackpoint {
                    ele: *ele,
                    ..Default::default()
                });
            }
            trkseg.push(chunk);
        }
        trkseg
    }

    fn simplify(eles: &[f64], epsilon: f64) -> Vec<usize> {
        let trkseg = segment(eles);
        ramer_douglas_peucker(&trkseg, &|idx| (idx.flat as f64, trkseg[idx].ele), epsilon)
            .iter()
            .map(|idx| idx.flat)
            .collect()
    }

    #[test]
    fn test_empty_and_single_point() {
        assert!(simplify(&[], 1.0).is_empty());
        assert_eq!(simplify(&[5.0], 1.0), vec![0]);
    }

    #[test]
    fn test_collinear_points_are_removed() {
        let eles: Vec<f64> = (0..20).map(|i| i as f64 * 2.0).collect();
        assert_eq!(simplify(&eles, 0.1), vec![0, 19]);
    }

    #[test]
    fn test_peak_is_kept_when_above_epsilon() {
        let eles = [0.0, 0.0, 0.0, 10.0, 0.0, 0.0, 0.0];
        assert_eq!(simplify(&eles, 5.0), vec![0, 3, 6]);
    }

    #[test]
    fn test_peak_is_dropped_when_below_epsilon() {
        let eles = [0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0];
        assert_eq!(simplify(&eles, 1.0), vec![0, 6]);
    }

    #[test]
    fn test_indices_are_sorted_and_keep_extremities() {
        let eles = [0.0, 5.0, -3.0, 8.0, 1.0, 9.0, -4.0, 2.0, 7.0, 0.0];
        let kept = simplify(&eles, 0.5);
        assert_eq!(kept.first(), Some(&0));
        assert_eq!(kept.last(), Some(&9));
        assert!(kept.windows(2).all(|w| w[0] < w[1]));
        // a larger epsilon never keeps more points
        assert!(simplify(&eles, 5.0).len() <= kept.len());
    }
}
