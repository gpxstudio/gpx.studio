import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { categoryIntervals, categoryValues, type CategoryIntervals } from './trackpoint-categories';

describe('categoryValues', () => {
    // asphalt, asphalt, unknown, gravel, gravel, gravel, unknown
    const intervals: CategoryIntervals = {
        starts: new Uint32Array([0, 2, 3, 6]),
        values: new Uint8Array([1, 0, 2, 0]),
        names: ['asphalt', 'gravel'],
    };

    it('is the name of the value of the interval of each trackpoint', () => {
        assert.deepEqual(categoryValues(intervals, 7), [
            'asphalt',
            'asphalt',
            undefined,
            'gravel',
            'gravel',
            'gravel',
            undefined,
        ]);
    });

    it('goes on with the last interval until the last trackpoint', () => {
        const last = { ...intervals, values: new Uint8Array([1, 0, 2, 2]) };
        assert.deepEqual(categoryValues(last, 9).slice(5), [
            'gravel',
            'gravel',
            'gravel',
            'gravel',
        ]);
    });

    it('does not go past the trackpoints', () => {
        assert.deepEqual(categoryValues(intervals, 3), ['asphalt', 'asphalt', undefined]);
        assert.deepEqual(categoryValues(intervals, 0), []);
    });

    it('is undefined without intervals, or for a code without name', () => {
        assert.deepEqual(categoryValues(undefined, 2), [undefined, undefined]);
        const unnamed = { starts: new Uint32Array([0]), values: new Uint8Array([3]), names: [] };
        assert.deepEqual(categoryValues(unnamed, 2), [undefined, undefined]);
    });
});

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
