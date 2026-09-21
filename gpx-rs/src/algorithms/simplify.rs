use crate::gpx::TrackPoint;

pub fn ramer_douglas_peucker<F>(n: usize, distance: &F, epsilon: f64) -> Vec<usize>
where
    F: Fn(usize, usize, usize) -> f64,
{
    if n <= 2 {
        (0..n).collect()
    } else {
        let mut indices = vec![0];
        ramer_douglas_peucker_helper(0, n - 1, distance, epsilon, &mut indices);
        indices.push(n - 1);
        indices
    }
}

fn ramer_douglas_peucker_helper<F>(
    start: usize,
    end: usize,
    distance: &F,
    epsilon: f64,
    indices: &mut Vec<usize>,
) where
    F: Fn(usize, usize, usize) -> f64,
{
    let mut idx = 0;
    let mut max_dist = 0.0;

    for i in (start + 1)..end {
        let dist = distance(start, end, i);
        if dist > max_dist {
            idx = i;
            max_dist = dist;
        }
    }

    if max_dist > epsilon && idx != 0 {
        ramer_douglas_peucker_helper(start, idx, distance, epsilon, indices);
        indices.push(idx);
        ramer_douglas_peucker_helper(idx, end, distance, epsilon, indices);
    }
}
