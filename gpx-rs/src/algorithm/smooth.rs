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
            window_center = $trkseg.next_index(window_center);
        }
    }};
}
