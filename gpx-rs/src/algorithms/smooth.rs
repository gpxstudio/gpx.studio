#[macro_export]
macro_rules! for_each_window {
    (
        $left:expr,
        $right:expr,
        $window:expr,
        |$a:ident, $b:ident| $distance:expr,
        |$i:ident, $l:ident, $r:ident| $body:block,
    ) => {{
        let mut start = $left;

        for $i in $left..$right {
            while start + 1 < $i && {
                let $a = start;
                let $b = $i;
                $distance
            } > $window
            {
                start += 1;
            }

            let mut end = $right.min($i + 2);

            while end < $right && {
                let $a = $i;
                let $b = end;
                $distance
            } <= $window
            {
                end += 1;
            }

            let $l = start;
            let $r = end - 1;

            $body
        }
    }};
}
