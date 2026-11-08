import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closestPointIndexIn } from '$lib/geo/closest-point';

describe('closestPointIndexIn', () => {
    const lng = [0, 1, 2, 2, 5, 6];
    const lat = [0, 0, 0, 1, 5, 5];

    it('gives the index in the arrays, looking at the given range only', () => {
        assert.equal(closestPointIndexIn(lng, lat, 0, 4, { lng: 0.8, lat: 0.1 }), 1);
        // the range starts after the closest points
        assert.equal(closestPointIndexIn(lng, lat, 4, 6, { lng: 0.8, lat: 0.1 }), 4);
        assert.equal(closestPointIndexIn(lng, lat, 4, 6, { lng: 5.9, lat: 5.1 }), 5);
    });

    it('is the nearest end of the nearest segment', () => {
        assert.equal(closestPointIndexIn(lng, lat, 0, 4, { lng: 0.2, lat: 0.1 }), 0);
        assert.equal(closestPointIndexIn(lng, lat, 0, 4, { lng: 1.6, lat: -0.1 }), 2);
        assert.equal(closestPointIndexIn(lng, lat, 0, 4, { lng: 2.1, lat: 0.9 }), 3);
    });

    it('uses the distance to the segment, not to its ends', () => {
        // far from every point but right next to the long segment
        const [x, y] = [
            [0, 10, 10],
            [0, 0, 5],
        ];
        assert.equal(closestPointIndexIn(x, y, 0, 3, { lng: 7, lat: 0.01 }), 1);
        assert.equal(closestPointIndexIn(x, y, 0, 3, { lng: 3, lat: 0.01 }), 0);
    });

    it('has no point in an empty range', () => {
        assert.equal(closestPointIndexIn(lng, lat, 3, 3, { lng: 0, lat: 0 }), undefined);
        assert.equal(closestPointIndexIn(lng, lat, 4, 2, { lng: 0, lat: 0 }), undefined);
    });

    it('is the point itself for a range of one point', () => {
        assert.equal(closestPointIndexIn(lng, lat, 3, 4, { lng: 9, lat: 9 }), 3);
    });
});
