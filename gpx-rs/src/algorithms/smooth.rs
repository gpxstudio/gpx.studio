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
        let mut start = $left.unwrap_or_default();
        let mut cur = $left;
        while let Some(idx) = cur {
            // advance left if needed
            while start != idx && {
                let $a = start;
                let $b = idx;
                $distance
            } > $window {
                if let Some(next) = $trkseg.next_index(Some(start)) {
                    if next == idx {
                        break;
                    }
                    start = next;
                } else {
                    break;
                }
            }
            // advance right if needed
            let mut end = idx;
            while let Some(next) = $trkseg.next_index(Some(end)) {
                if {
                    let $a = idx;
                    let $b = end;
                    $distance
                } > $window {
                    break;
                }
                end = next;
            }
            // apply body
            let $i = idx;
            let $l = start;
            let $r = end;
            $body
            // go next
            cur = $trkseg.next_index(cur);
        }
    }};
}
