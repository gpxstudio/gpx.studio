import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import type { LayerTreeType } from '$lib/assets/layers';
import {
    filterLayerTree,
    getArrayValidator,
    getLayerTreeValidator,
    getLayerValidator,
    getValueValidator,
    Setting,
    SettingInitOnFirstRead,
    storedValue,
    useSettingsStorage,
} from './setting';

/** What the settings were told to keep. */
let saved: Record<string, string | undefined>;

beforeEach(() => {
    saved = {};
    useSettingsStorage({
        save: (key, json) => {
            saved[key] = json;
        },
        remove: (key) => {
            saved[key] = undefined;
        },
    });
});

afterEach(() => useSettingsStorage(undefined));

describe('reading saved values', () => {
    it('reads JSON, and nothing when it cannot', () => {
        assert.deepEqual(storedValue({ a: '3' }, 'a'), { value: 3 });
        assert.deepEqual(storedValue({ a: '"text"' }, 'a'), { value: 'text' });
        assert.deepEqual(storedValue({ a: 'null' }, 'a'), { value: null });
        assert.equal(storedValue({ a: '{broken' }, 'a'), undefined);
        assert.equal(storedValue({}, 'a'), undefined);
        // a key of Object.prototype is not a saved key
        assert.equal(storedValue({}, 'toString'), undefined);
    });
});

describe('validators', () => {
    it('keeps an allowed value, else the fallback', () => {
        const validate = getValueValidator(['metric', 'imperial'], 'metric');
        assert.equal(validate('imperial'), 'imperial');
        assert.equal(validate('nautical'), 'metric');
        assert.equal(validate(undefined as any), 'metric');
        const optional = getValueValidator<string | undefined>(['slope', undefined], undefined);
        assert.equal(optional('slope'), 'slope');
        assert.equal(optional('other'), undefined);
    });

    it('keeps the allowed values of a list', () => {
        const validate = getArrayValidator(['hr', 'cad', 'power']);
        assert.deepEqual(validate(['power', 'speed', 'hr', 'hr']), ['power', 'hr', 'hr']);
        assert.deepEqual(validate([]), []);
    });

    it('accepts the known layers, and the custom and extension ones', () => {
        const validate = getLayerValidator({ libertyTopo: 'url', osm: 'url' }, 'libertyTopo');
        assert.equal(validate('osm'), 'osm');
        assert.equal(validate('custom-1234'), 'custom-1234');
        assert.equal(validate('extension-some-id'), 'extension-some-id');
        assert.equal(validate('gone'), 'libertyTopo');
        assert.equal(validate('toString'), 'libertyTopo');
    });
});

describe('layer trees', () => {
    const allowed: LayerTreeType = {
        world: { a: true, b: false },
        countries: { france: { c: false } },
    };

    it('keeps the choices made on the layers that are allowed', () => {
        const filtered = filterLayerTree({ world: { a: false, b: true } }, allowed);
        assert.deepEqual(filtered.world as LayerTreeType, { a: false, b: true });
    });

    it('adds the layers that are new, with their default', () => {
        const filtered = filterLayerTree({ world: { a: false } }, allowed);
        assert.deepEqual(filtered, {
            world: { a: false, b: false },
            countries: { france: { c: false } },
        });
        assert.deepEqual(filterLayerTree({}, allowed), allowed);
    });

    it('drops the layers that are not allowed anymore, but not the custom ones', () => {
        const filtered = filterLayerTree(
            {
                world: { a: true, gone: true, 'custom-1': true, 'extension-x': false },
                old: { x: true },
            },
            allowed
        );
        assert.deepEqual(filtered.world, {
            a: true,
            b: false,
            'custom-1': true,
            'extension-x': false,
        });
        assert.equal('old' in filtered, true);
        assert.deepEqual(filtered.old, {});
    });

    it('does not take a branch for a layer, or a layer for a branch', () => {
        const filtered = filterLayerTree({ world: true, countries: { france: false } }, allowed);
        assert.deepEqual(filtered.world, { a: true, b: false });
        assert.deepEqual((filtered.countries as LayerTreeType).france, { c: false });
        assert.deepEqual(getLayerTreeValidator(allowed)({ world: { a: false } }).world, {
            a: false,
            b: false,
        });
    });
});

describe('Setting', () => {
    it('has its initial value until it is connected', () => {
        const setting = new Setting('key', 'initial');
        assert.equal(get(setting), 'initial');
        setting.connect({});
        assert.equal(get(setting), 'initial');
        setting.connect({ other: '"x"' });
        assert.equal(get(setting), 'initial');
    });

    it('takes the saved value, validated', () => {
        const setting = new Setting(
            'key',
            'metric',
            getValueValidator(['metric', 'imperial'], 'metric')
        );
        setting.connect({ key: '"imperial"' });
        assert.equal(get(setting), 'imperial');
        setting.connect({ key: '"furlongs"' });
        assert.equal(get(setting), 'metric');
        setting.connect({ key: '{broken' });
        assert.equal(get(setting), 'metric');
        // connecting does not save anything
        assert.deepEqual(saved, {});
    });

    it('saves what it is set to, when it changes', () => {
        const setting = new Setting('key', 1);
        setting.set(2);
        assert.equal(get(setting), 2);
        assert.deepEqual(saved, { key: '2' });
        saved = {};
        setting.set(2);
        assert.deepEqual(saved, {});
        setting.update((value) => value + 1);
        assert.equal(get(setting), 3);
        assert.deepEqual(saved, { key: '3' });
    });

    it('always saves objects, which may have been changed in place', () => {
        const value = { a: 1 };
        const setting = new Setting('key', value);
        setting.set(value);
        assert.deepEqual(saved, { key: '{"a":1}' });
    });

    it('forgets what it saved when it has no value', () => {
        const setting = new Setting<string | undefined>('key', 'x');
        setting.set(undefined);
        assert.equal(get(setting), undefined);
        assert.ok('key' in saved);
        assert.equal(saved.key, undefined);
    });

    it('tells its subscribers', () => {
        const setting = new Setting('key', 1);
        const seen: number[] = [];
        const unsubscribe = setting.subscribe((value) => seen.push(value));
        setting.set(2);
        setting.set(2);
        unsubscribe();
        setting.set(3);
        assert.deepEqual(seen, [1, 2]);
    });
});

describe('SettingInitOnFirstRead', () => {
    it('has no value until it is connected', () => {
        const setting = new SettingInitOnFirstRead('key', { a: true });
        assert.equal(get(setting), undefined);
        setting.connect({});
        assert.deepEqual(get(setting), { a: true });
    });

    it('takes the saved value, validated, instead of the initial one', () => {
        const setting = new SettingInitOnFirstRead('key', ['hr'], getArrayValidator(['hr', 'cad']));
        setting.connect({ key: '["cad","nope"]' });
        assert.deepEqual(get(setting), ['cad']);
        // nothing is saved when it is connected, that is what `initialize` is for
        assert.deepEqual(saved, {});
    });

    it('can be initialized, which saves the initial value', () => {
        const setting = new SettingInitOnFirstRead('key', 5);
        setting.initialize();
        assert.equal(get(setting), 5);
        assert.deepEqual(saved, { key: '5' });
    });
});

describe('Setting without storage', () => {
    it('changes, but keeps nothing', () => {
        useSettingsStorage(undefined);
        const setting = new Setting('key', 1);
        setting.set(2);
        assert.equal(get(setting), 2);
        assert.deepEqual(saved, {});
    });
});
