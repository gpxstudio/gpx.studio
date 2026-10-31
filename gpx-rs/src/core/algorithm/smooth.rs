#[macro_export]
macro_rules! for_each_window {
    (
        $trkseg:expr,
        $left:expr,
        $right:expr,
        $window:expr,
        |$a:ident, $b:ident| $distance:expr,
        |$i:ident, $l:ident, $r:ident| $body:block,
    ) => {{
        let mut window_start = $left.unwrap_or_default();
        let mut window_center = $left;
        let mut window_end = $left.unwrap_or_default();
        while let Some(idx) = window_center {
            // advance left if needed
            while window_start != idx && {
                let $a = window_start;
                let $b = idx;
                $distance
            } > $window {
                if let Some(next) = $trkseg.next_index(Some(window_start)) {
                    if next == idx {
                        break;
                    }
                    window_start = next;
                } else {
                    break;
                }
            }
            // advance right if needed
            window_end = window_end.max(idx);
            while let Some(next) = $trkseg.next_index(Some(window_end)) {
                if window_end != idx && {
                    let $a = idx;
                    let $b = next;
                    $distance
                } > $window {
                    break;
                }
                window_end = next;
            }
            // apply body
            let $i = idx;
            let $l = window_start;
            let $r = window_end;
            $body
            // go next
            if window_center == $right {
                break;
            }
            window_center = $trkseg.next_index(window_center);
        }
    }};
}

#[cfg(test)]
mod tests {
    use crate::{TrackSegment, Trackpoint, TrackpointChunk};

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

    /// Returns (center, left, right) flat indices for each visited center.
    fn windows(len: usize, window: f64) -> Vec<(usize, usize, usize)> {
        let trkseg = segment(&vec![0.0; len]);
        let mut visited = vec![];
        for_each_window!(
            trkseg,
            trkseg.first_index(),
            trkseg.last_index(),
            window,
            |a, b| (b.flat - a.flat) as f64,
            |i, l, r| {
                visited.push((i.flat, l.flat, r.flat));
            },
        );
        visited
    }

    #[test]
    fn test_window_bounds() {
        let visited = windows(10, 2.0);
        assert_eq!(visited.len(), 10);
        for (i, l, r) in visited {
            assert_eq!(l, i.saturating_sub(2), "left of {i}");
            assert_eq!(r, (i + 2).min(9), "right of {i}");
        }
    }

    #[test]
    fn test_window_always_includes_neighbours() {
        for (i, l, r) in windows(6, 0.0) {
            assert_eq!((l, r), (i.saturating_sub(1), (i + 1).min(5)));
        }
    }

    #[test]
    fn test_window_larger_than_segment() {
        for (_, l, r) in windows(5, 100.0) {
            assert_eq!((l, r), (0, 4));
        }
    }

    #[test]
    fn test_window_sub_range() {
        let trkseg = segment(&[0.0; 10]);
        let mut centers = vec![];
        let mut first = trkseg.first_index();
        for _ in 0..3 {
            first = trkseg.next_index(first);
        }
        let mut last = first;
        for _ in 0..2 {
            last = trkseg.next_index(last);
        }
        for_each_window!(
            trkseg,
            first,
            last,
            1.0,
            |a, b| (b.flat - a.flat) as f64,
            |i, _l, _r| {
                centers.push(i.flat);
            },
        );
        assert_eq!(centers, vec![3, 4, 5]);
    }
}
