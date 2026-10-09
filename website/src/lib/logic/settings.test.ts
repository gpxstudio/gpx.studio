import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import { engine } from '$lib/engine';
import { settings } from './settings';

/** What the engine was told to keep. */
let saved: Record<string, string | undefined>;

/** What was kept, seen without what the assertions made of its type. */
const kept = (): Record<string, string | undefined> => saved;
const original = { set: engine.setSetting, delete: engine.deleteSetting };

beforeEach(() => {
    saved = {};
    engine.setSetting = (key, json) => {
        saved[key] = json;
    };
    engine.deleteSetting = (key) => {
        saved[key] = undefined;
    };
});

afterEach(() => {
    engine.setSetting = original.set;
    engine.deleteSetting = original.delete;
});

describe('settings', () => {
    it('connects every setting', () => {
        settings.connect({
            distanceUnits: '"imperial"',
            velocityUnits: '"pace"',
            temperatureUnits: '"fahrenheit"',
            routingProfile: '"foot"',
            currentOverlays: '{"cyclOSM":true}',
            additionalDatasets: '["hr","bogus"]',
        });
        assert.equal(get(settings.distanceUnits), 'imperial');
        assert.equal(get(settings.velocityUnits), 'pace');
        assert.equal(get(settings.temperatureUnits), 'fahrenheit');
        assert.equal(get(settings.routingProfile), 'foot');
        assert.deepEqual(get(settings.additionalDatasets), ['hr']);
        assert.ok(get(settings.currentOverlays));

        // values that are not valid anymore are replaced
        settings.connect({ distanceUnits: '"cubits"', routingProfile: '"hovercraft"' });
        assert.equal(get(settings.distanceUnits), 'metric');
        assert.equal(get(settings.routingProfile), 'bike');
    });

    it('initializes the settings that have no value until they are read', () => {
        settings.connect({});
        saved = {};
        settings.initialize();
        assert.ok('currentOverlays' in saved);
        assert.ok('currentOverpassQueries' in saved);
        assert.equal(Object.keys(saved).length, 2);
    });

    it('are kept by the engine when they change', () => {
        settings.connect({});
        settings.distanceUnits.set('nautical');
        assert.deepEqual(saved, { distanceUnits: '"nautical"' });
        // a setting that has no value is forgotten
        settings.elevationFill.set('slope');
        assert.equal(kept().elevationFill, '"slope"');
        settings.elevationFill.set(undefined);
        assert.ok('elevationFill' in kept() && kept().elevationFill === undefined);
        saved = {};
        // the same value is not kept again
        settings.distanceUnits.set('nautical');
        assert.deepEqual(saved, {});
    });
});
