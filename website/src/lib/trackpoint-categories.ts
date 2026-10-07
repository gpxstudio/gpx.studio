/**
 * A category of the engine (surface, highway...) for each trackpoint, as the intervals of
 * consecutive trackpoints that share the same value: `starts[i]` is the index of the first
 * trackpoint of the interval `i`, which lasts until the next start (or the last trackpoint). Its
 * `values[i]` is 0 when the value is unknown, else 1 + the index of the value in `names`.
 */
export type CategoryIntervals = {
    starts: Uint32Array;
    values: Uint8Array;
    /** Names of the values, by code: a name keeps its index. */
    names: string[];
};

/**
 * The value of each of the `length` trackpoints for a category of the engine, `undefined` when it
 * is unknown, or when the category is missing (it is unknown for every trackpoint). The intervals
 * are scanned once, so it takes a time linear in `length`.
 */
export function categoryValues(
    intervals: CategoryIntervals | undefined,
    length: number
): (string | undefined)[] {
    const result: (string | undefined)[] = new Array(length).fill(undefined);
    if (!intervals) {
        return result;
    }
    const { starts, values, names } = intervals;
    for (let i = 0; i < starts.length; i++) {
        if (!values[i]) {
            continue; // unknown, already `undefined`
        }
        const name = names[values[i] - 1];
        const end = i + 1 < starts.length ? Math.min(starts[i + 1], length) : length;
        result.fill(name, starts[i], end);
    }
    return result;
}
