import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import { isCustomLayer, type LayerTreeType } from '$lib/data/layers';
import {
    filterLayerTree,
    getArrayValidator,
    getLayerTreeValidator,
    getLayerValidator,
    getListValidator,
    getRecordValidator,
    getValueValidator,
    isNumber,
    isString,
    Setting,
    SettingInitOnFirstRead,
    storedValue,
    useSettingsStorage,
} from '$lib/state/setting';

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
        assert.equal(validate(undefined), 'metric');
        assert.equal(validate(null), 'metric');
        assert.equal(validate(3), 'metric');
        const optional = getValueValidator<string | undefined>(['slope', undefined], undefined);
        assert.equal(optional('slope'), 'slope');
        assert.equal(optional('other'), undefined);
    });

    it('keeps the allowed values of a list', () => {
        const validate = getArrayValidator(['hr', 'cad', 'power']);
        assert.deepEqual(validate(['power', 'speed', 'hr', 'hr']), ['power', 'hr', 'hr']);
        assert.deepEqual(validate([]), []);
    });

    it('keeps nothing of a saved value that is not a list', () => {
        const validate = getArrayValidator(['hr', 'cad', 'power']);
        for (const saved of [null, 'hr', 3, { 0: 'hr' }]) {
            assert.deepEqual(validate(saved), []);
        }
    });

    it('keeps the items of a list that are what it holds', () => {
        const validate = getListValidator(isString);
        assert.deepEqual(validate(['a', 3, null, 'b']), ['a', 'b']);
        assert.deepEqual(validate('a'), []);
    });

    it('keeps the entries of a record that are what it holds, else takes the fallback', () => {
        const fallback = { a: 0.5 };
        const validate = getRecordValidator(isNumber, fallback);
        assert.deepEqual(validate({ a: 0.4, b: 'x', c: 1 }), { a: 0.4, c: 1 });
        for (const saved of [null, 3, ['a'], 'a']) {
            assert.equal(validate(saved), fallback);
        }
    });

    it('recognizes a custom layer', () => {
        const layer = {
            id: 'custom-0',
            name: 'Layer',
            tileUrls: ['https://tiles/{z}/{x}/{y}.png'],
            maxZoom: 20,
            layerType: 'basemap',
            resourceType: 'raster',
            value: { version: 8, sources: {}, layers: [] },
        };
        assert.ok(isCustomLayer(layer));
        assert.ok(isCustomLayer({ ...layer, resourceType: 'vector', value: 'https://style.json' }));
        assert.ok(!isCustomLayer({ ...layer, layerType: 'other' }));
        assert.ok(!isCustomLayer({ ...layer, tileUrls: [3] }));
        assert.ok(!isCustomLayer({ ...layer, value: null }));
        const { name: _name, ...nameless } = layer;
        assert.ok(!isCustomLayer(nameless));
        assert.ok(!isCustomLayer(null));
    });

    it('accepts the known layers, and the custom and extension ones', () => {
        const validate = getLayerValidator({ libertyTopo: 'url', osm: 'url' }, 'libertyTopo');
        assert.equal(validate('osm'), 'osm');
        assert.equal(validate('custom-1234'), 'custom-1234');
        assert.equal(validate('extension-some-id'), 'extension-some-id');
        assert.equal(validate('gone'), 'libertyTopo');
        assert.equal(validate('toString'), 'libertyTopo');
        for (const saved of [null, 3, ['osm'], { id: 'osm' }]) {
            assert.equal(validate(saved), 'libertyTopo');
        }
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
        // a branch saved for a layer, and values that are not choices
        assert.deepEqual(filterLayerTree({ world: { a: { x: true }, b: 'yes' } }, allowed).world, {
            a: true,
            b: false,
        });
    });

    it('takes the defaults when what was saved is not a tree', () => {
        for (const saved of [null, true, 'world', 3, ['world']]) {
            assert.deepEqual(filterLayerTree(saved, allowed), allowed);
        }
        assert.deepEqual(
            filterLayerTree({ world: null, old: null, other: [true] }, allowed),
            allowed
        );
    });

    it('does not share its branches with the allowed tree', () => {
        const filtered = filterLayerTree({}, allowed);
        (filtered.world as LayerTreeType).a = false;
        assert.equal((allowed.world as LayerTreeType).a, true);
    });
});

describe('Setting', () => {
    it('has its initial value until it is connected', () => {
        const setting = new Setting('key', 'initial', getValueValidator(['initial'], 'initial'));
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

    it('takes a saved boolean or number of the type of its initial value', () => {
        const flag = new Setting('flag', false);
        flag.connect({ flag: 'true' });
        assert.equal(get(flag), true);
        flag.connect({ flag: '"yes"' });
        assert.equal(get(flag), false);
        const size = new SettingInitOnFirstRead('size', 170);
        size.connect({ size: '240' });
        assert.equal(get(size), 240);
        size.connect({ size: 'null' });
        assert.equal(get(size), 170);
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
        const setting = new Setting('key', value, getRecordValidator(isNumber, value));
        setting.set(value);
        assert.deepEqual(saved, { key: '{"a":1}' });
    });

    it('forgets what it saved when it has no value', () => {
        const setting = new Setting<string | undefined>(
            'key',
            'x',
            getValueValidator<string | undefined>(['x', undefined], undefined)
        );
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
        const setting = new SettingInitOnFirstRead(
            'key',
            { a: true },
            getLayerTreeValidator({ a: true })
        );
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
