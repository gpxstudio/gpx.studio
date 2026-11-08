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

/** The index of the interval of `starts` (sorted) that the trackpoint `index` is in, -1 if none. */
export function intervalAt(starts: Uint32Array, index: number): number {
    let low = 0;
    let high = starts.length;
    // the first interval that starts after the trackpoint
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (starts[middle] <= index) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low - 1;
}

/** The value of the trackpoint `index` for a category, `undefined` when it is unknown. */
export function categoryValue(
    intervals: CategoryIntervals | undefined,
    index: number
): string | undefined {
    if (!intervals) {
        return undefined;
    }
    const value = intervals.values[intervalAt(intervals.starts, index)];
    return value ? intervals.names[value - 1] : undefined;
}

/**
 * The intervals of the trackpoints that share a value, for a value per trackpoint (`undefined`
 * when unknown): the inverse of `categoryValues`. The names are in the order of their first
 * appearance. A value that is unknown everywhere gives no intervals.
 */
export function categoryIntervals(values: readonly (string | undefined)[]): CategoryIntervals {
    const starts: number[] = [];
    const codes: number[] = [];
    const names: string[] = [];
    const known = new Map<string, number>();
    let last: number | undefined = undefined;
    values.forEach((value, index) => {
        let code = 0;
        if (value !== undefined) {
            if (!known.has(value)) {
                names.push(value);
                known.set(value, names.length);
            }
            code = known.get(value)!;
        }
        if (code !== last) {
            starts.push(index);
            codes.push(code);
            last = code;
        }
    });
    if (names.length === 0) {
        return { starts: new Uint32Array(), values: new Uint8Array(), names };
    }
    return { starts: Uint32Array.from(starts), values: Uint8Array.from(codes), names };
}
