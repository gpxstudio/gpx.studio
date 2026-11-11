import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    categoryIntervals,
    categoryValue,
    intervalAt,
    type CategoryIntervals,
} from '$lib/engine/trackpoint-categories';

/** The value of each of the `length` trackpoints, to compare with what is expected. */
function categoryValues(
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

describe('categoryIntervals', () => {
    it('groups the trackpoints that share a value', () => {
        const values = ['asphalt', 'asphalt', undefined, 'gravel', 'gravel', 'asphalt', undefined];
        const intervals = categoryIntervals(values);
        assert.deepEqual([...intervals.starts], [0, 2, 3, 5, 6]);
        assert.deepEqual([...intervals.values], [1, 0, 2, 1, 0]);
        assert.deepEqual(intervals.names, ['asphalt', 'gravel']);
        // and it goes back to the values
        assert.deepEqual(categoryValues(intervals, values.length), values);
    });

    it('has no intervals when the value is unknown everywhere', () => {
        for (const values of [[], [undefined, undefined]]) {
            const intervals = categoryIntervals(values);
            assert.equal(intervals.starts.length, 0);
            assert.equal(intervals.values.length, 0);
            assert.deepEqual(intervals.names, []);
        }
    });
});

describe('intervalAt', () => {
    const starts = new Uint32Array([0, 2, 3, 6]);

    it('is the interval that the trackpoint is in', () => {
        const intervals = [0, 1, 2, 3, 4, 5, 6, 9].map((index) => intervalAt(starts, index));
        assert.deepEqual(intervals, [0, 0, 1, 2, 2, 2, 3, 3]);
    });

    it('is -1 when there is no interval', () => {
        assert.equal(intervalAt(new Uint32Array(), 0), -1);
    });
});

describe('categoryValue', () => {
    const intervals: CategoryIntervals = {
        starts: new Uint32Array([0, 2, 3, 6]),
        values: new Uint8Array([1, 0, 2, 0]),
        names: ['asphalt', 'gravel'],
    };

    it('is the value of each trackpoint, as categoryValues', () => {
        const values = categoryValues(intervals, 7);
        values.forEach((value, index) => assert.equal(categoryValue(intervals, index), value));
    });

    it('is unknown without intervals', () => {
        assert.equal(categoryValue(undefined, 3), undefined);
        assert.equal(
            categoryValue({ starts: new Uint32Array(), values: new Uint8Array(), names: [] }, 0),
            undefined
        );
    });
});
