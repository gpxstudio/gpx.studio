import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getHighwayColor,
    getSlopeColor,
    getSurfaceColor,
    highwayColors,
    surfaceColors,
} from './colors';

describe('colors of the OSM data', () => {
    it('has the color of a surface, or the one of the missing ones', () => {
        assert.equal(getSurfaceColor('asphalt'), surfaceColors.asphalt);
        assert.equal(getSurfaceColor('grass'), '#61b55c');
        assert.equal(getSurfaceColor('something new'), surfaceColors.missing);
        assert.equal(getSurfaceColor(''), surfaceColors.missing);
    });

    it('has the color of a highway, or the one of the missing ones', () => {
        assert.equal(getHighwayColor('motorway', undefined, undefined), highwayColors.motorway);
        assert.equal(getHighwayColor('path', undefined, undefined), highwayColors.path);
        assert.equal(getHighwayColor('something new', undefined, undefined), highwayColors.missing);
    });
});

describe('slope colors', () => {
    const hue = (color: string) => Number(/hsl\(([-\d.e]+),/.exec(color)![1]);
    const lightness = (color: string) => Number(/,([\d.]+)%\)$/.exec(color)![1]);

    it('is yellow on the flat, redder uphill and greener downhill, symmetrically', () => {
        const flat = getSlopeColor(0);
        assert.equal(hue(flat), 60);
        assert.equal(lightness(flat), 90);
        // steeper is further from the flat color, in both directions
        assert.ok(hue(getSlopeColor(10)) < 60);
        assert.ok(hue(getSlopeColor(-10)) > 60);
        assert.ok(lightness(getSlopeColor(10)) < 90);
        assert.ok(hue(getSlopeColor(20)) < hue(getSlopeColor(10)));
        const up = getSlopeColor(7);
        const down = getSlopeColor(-7);
        assert.ok(Math.abs(hue(up) + hue(down) - 120) < 1e-9);
        assert.ok(Math.abs(lightness(up) - lightness(down)) < 1e-9);
    });

    it('does not go further than 20 %', () => {
        assert.equal(getSlopeColor(20), getSlopeColor(35));
        assert.equal(getSlopeColor(1000), getSlopeColor(20));
        assert.equal(getSlopeColor(-20), getSlopeColor(-55));
        assert.notEqual(getSlopeColor(19), getSlopeColor(20));
    });
});
