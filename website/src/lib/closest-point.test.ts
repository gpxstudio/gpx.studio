import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closestPointIndex } from './closest-point';

describe('closestPointIndex', () => {
    const line = [0, 0, 1, 0, 2, 0, 2, 1];

    it('has no point on an empty polyline', () => {
        assert.equal(closestPointIndex([], { lng: 0, lat: 0 }), undefined);
    });

    it('is the only point of a polyline of one point', () => {
        assert.equal(closestPointIndex([3, 4], { lng: 0, lat: 0 }), 0);
    });

    it('is the nearest end of the nearest segment', () => {
        assert.equal(closestPointIndex(line, { lng: 0.2, lat: 0.1 }), 0);
        assert.equal(closestPointIndex(line, { lng: 0.8, lat: 0.1 }), 1);
        assert.equal(closestPointIndex(line, { lng: 1.6, lat: -0.1 }), 2);
        assert.equal(closestPointIndex(line, { lng: 2.1, lat: 0.9 }), 3);
    });

    it('uses the distance to the segment, not to its ends', () => {
        // far from every point but right next to the long segment
        const coordinates = [0, 0, 10, 0, 10, 5];
        assert.equal(closestPointIndex(coordinates, { lng: 7, lat: 0.01 }), 1);
        assert.equal(closestPointIndex(coordinates, { lng: 3, lat: 0.01 }), 0);
    });
});
