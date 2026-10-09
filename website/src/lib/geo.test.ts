import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { distance } from './geo';

describe('distance', () => {
    it('is zero between a point and itself', () => {
        assert.equal(distance({ lng: 4, lat: 50 }, { lng: 4, lat: 50 }), 0);
    });

    it('measures a degree of latitude and longitude', () => {
        const meridian = distance({ lng: 0, lat: 0 }, { lng: 0, lat: 1 });
        assert.ok(Math.abs(meridian - 111195) < 10, `${meridian}`);
        const equator = distance({ lng: 0, lat: 0 }, { lng: 1, lat: 0 });
        assert.ok(Math.abs(equator - 111195) < 10, `${equator}`);
        // degrees of longitude get shorter away from the equator
        const north = distance({ lng: 0, lat: 60 }, { lng: 1, lat: 60 });
        assert.ok(Math.abs(north - 111195 / 2) < 100, `${north}`);
    });

    it('is symmetric and handles the antipodes and the antimeridian', () => {
        const a = { lng: 4.35, lat: 50.85 };
        const b = { lng: -74, lat: 40.7 };
        assert.equal(distance(a, b), distance(b, a));
        assert.ok(Math.abs(distance(a, b) - 5900_000) < 100_000);
        const half = Math.PI * 6371008.8;
        assert.ok(Math.abs(distance({ lng: 0, lat: 0 }, { lng: 180, lat: 0 }) - half) < 1);
        assert.ok(Math.abs(distance({ lng: 0, lat: 90 }, { lng: 0, lat: -90 }) - half) < 1);
        const across = distance({ lng: 179.5, lat: 0 }, { lng: -179.5, lat: 0 });
        assert.ok(Math.abs(across - 111195) < 10, `${across}`);
    });
});
