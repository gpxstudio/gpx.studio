// The API that browser extensions use to add overlays to the map (`window.gpxstudio`).
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import { overlays, overlayTree, type LayerTreeType } from '$lib/data/layers';
import { engine } from '$lib/engine';
import { settings } from '$lib/state/settings';
import { map } from '$lib/components/map/map';
import type { StyleSpecification } from 'maplibre-gl';
import { ExtensionAPI, type CustomOverlay, type ExtensionOverlay } from './extension-api';
import { isSelected, prefixStyle } from './utils';

const original = { set: engine.setSetting, delete: engine.deleteSetting };

/** The raster source that an overlay added by an extension uses. */
function rasterSource(id: string) {
    const style = overlays[id];
    assert.ok(typeof style === 'object');
    const source = style.sources[id];
    assert.ok(source?.type === 'raster');
    return source;
}
const overlayTreeBefore = JSON.stringify(overlayTree);
const overlayIdsBefore = Object.keys(overlays).sort();

const overlay = (id: string, extensionName = 'My extension'): CustomOverlay => ({
    extensionName,
    id,
    name: `Overlay ${id}`,
    tileUrls: [`https://tiles.example.com/${id}/{z}/{x}/{y}.png`],
});

let api: ExtensionAPI;

beforeEach(() => {
    engine.setSetting = () => {};
    engine.deleteSetting = () => {};
    settings.connect({});
    settings.initialize();
    api = new ExtensionAPI();
});

afterEach(() => {
    // the layers are shared by the whole app: leave them as they were
    api.filterOverlays([]);
    api.setOverlays('Heatmaps', []);
    api.setOverlays('Other', []);
    for (const extension of ['My extension', 'Other extension']) {
        delete (overlayTree.overlays as LayerTreeType)[extension];
    }
    engine.setSetting = original.set;
    engine.deleteSetting = original.delete;
    assert.equal(JSON.stringify(overlayTree), overlayTreeBefore);
    assert.deepEqual(Object.keys(overlays).sort(), overlayIdsBefore);
});

describe('ExtensionAPI', () => {
    it('adds an overlay as a layer, in the tree of its extension', () => {
        api.addOrUpdateOverlay(overlay('one'));

        const source = rasterSource('extension-one');
        assert.deepEqual(source.tiles, ['https://tiles.example.com/one/{z}/{x}/{y}.png']);
        assert.equal(source.tileSize, 256);
        assert.equal(source.maxzoom, 22);

        assert.ok((overlayTree.overlays as LayerTreeType)['My extension']);
        assert.equal(isSelected(overlayTree, 'extension-one'), true);
        assert.equal(isSelected(get(settings.selectedOverlayTree), 'extension-one'), true);
        // not shown until the user chooses to
        assert.equal(isSelected(get(settings.currentOverlays)!, 'extension-one'), false);
        assert.ok(get(api.isLayerFromExtension)('extension-one'));
        assert.equal(get(api.getLayerName)('extension-one'), 'Overlay one');
        assert.equal(get(api.getLayerName)('other'), '');
    });

    it('uses big tiles when the urls say so, and the max zoom it is given', () => {
        api.addOrUpdateOverlay({
            ...overlay('big'),
            tileUrls: ['https://tiles.example.com/512/{z}/{x}/{y}.png'],
            maxZoom: 15,
        });
        const source = rasterSource('extension-big');
        assert.equal(source.tileSize, 512);
        assert.equal(source.maxzoom, 15);
    });

    it('refuses an overlay that is not complete', () => {
        for (const bad of [
            { ...overlay('a'), extensionName: '' },
            { ...overlay('a'), id: '' },
            { ...overlay('a'), name: '' },
            { ...overlay('a'), tileUrls: [] },
            { ...overlay('a'), tileUrls: undefined as unknown as string[] },
        ]) {
            assert.throws(() => api.addOrUpdateOverlay(bad), /must have/);
        }
        assert.ok(!('extension-a' in overlays));
    });

    it('updates an overlay that is added again, keeping it shown', () => {
        api.addOrUpdateOverlay(overlay('one'));
        settings.currentOverlays.update((current) => {
            (current.overlays as LayerTreeType)['My extension'] = { 'extension-one': true };
            return current;
        });

        api.addOrUpdateOverlay({
            ...overlay('one'),
            name: 'Renamed',
            tileUrls: ['https://other/{z}'],
        });
        assert.equal(get(api.getLayerName)('extension-one'), 'Renamed');
        assert.deepEqual(rasterSource('extension-one').tiles, ['https://other/{z}']);
        assert.equal(isSelected(get(settings.currentOverlays)!, 'extension-one'), true);
    });

    it('removes the overlays that are not in the list anymore, everywhere', () => {
        api.addOrUpdateOverlay(overlay('one'));
        api.addOrUpdateOverlay(overlay('two', 'Other extension'));

        api.filterOverlays(['two']);
        assert.ok(!('extension-one' in overlays));
        assert.ok('extension-two' in overlays);
        assert.equal(get(api.isLayerFromExtension)('extension-one'), false);
        assert.equal(get(api.isLayerFromExtension)('extension-two'), true);
        for (const tree of [
            overlayTree,
            get(settings.selectedOverlayTree),
            get(settings.currentOverlays)!,
        ]) {
            assert.equal(isSelected(tree, 'extension-one'), false);
        }
        assert.equal(isSelected(overlayTree, 'extension-two'), true);

        api.filterOverlays([]);
        assert.ok(!('extension-two' in overlays));
    });

    it('puts the overlays in the order it is given', () => {
        api.addOrUpdateOverlay(overlay('one'));
        api.addOrUpdateOverlay(overlay('two'));
        api.addOrUpdateOverlay(overlay('three'));

        api.updateOverlaysOrder(['three', 'one', 'two']);
        const extension = (get(settings.selectedOverlayTree).overlays as LayerTreeType)[
            'My extension'
        ];
        assert.deepEqual(Object.keys(extension as LayerTreeType), [
            'extension-three',
            'extension-one',
            'extension-two',
        ]);
        // ids it does not know are ignored
        api.updateOverlaysOrder(['unknown', 'two']);
        assert.equal(Object.keys(extension as LayerTreeType).at(-1), 'extension-two');
    });
});

const rasterStyle = (url = 'https://tiles.example.com/{z}/{x}/{y}.png'): StyleSpecification => ({
    version: 8,
    sources: { tiles: { type: 'raster', tiles: [url], tileSize: 256 } },
    layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }],
});

const v2 = (id: string, extra: Partial<ExtensionOverlay> = {}): ExtensionOverlay => ({
    id,
    name: `Overlay ${id}`,
    style: rasterStyle(),
    ...extra,
});

const id = (overlayId: string, extension = 'Heatmaps') =>
    `extension-${encodeURIComponent(extension)}/${encodeURIComponent(overlayId)}`;

/** The overlays of an extension in a tree, with their state. */
const group = (tree: LayerTreeType | undefined, extension = 'Heatmaps') =>
    (tree!.overlays as LayerTreeType)[extension] as LayerTreeType | undefined;

/** What the user does in the layer menu. */
function setShown(overlayId: string, shown: boolean) {
    settings.currentOverlays.update((tree) => {
        group(tree)![overlayId] = shown;
        return tree;
    });
}

describe('prefixStyle', () => {
    it('prefixes the sources, the layers, and the source of the layers', () => {
        const prefixed = prefixStyle('overlay', {
            version: 8,
            sources: { dem: { type: 'raster-dem', tiles: ['https://dem/{z}/{x}/{y}.png'] } },
            layers: [
                { id: 'relief', type: 'color-relief', source: 'dem' },
                { id: 'background', type: 'background' },
            ],
        });
        assert.deepEqual(Object.keys(prefixed.sources), ['overlay/dem']);
        assert.deepEqual(
            prefixed.layers.map((layer) => layer.id),
            ['overlay/relief', 'overlay/background']
        );
        assert.equal((prefixed.layers[0] as { source: string }).source, 'overlay/dem');
        assert.equal('source' in prefixed.layers[1], false);
    });

    it('refuses a style whose layers cannot work', () => {
        const style = (layers: unknown) =>
            ({ version: 8, sources: {}, layers }) as StyleSpecification;
        assert.throws(() => prefixStyle('o', style(undefined)), /list of layers/);
        assert.throws(
            () => prefixStyle('o', style([{ id: 'a', type: 'raster', source: 'none' }])),
            /unknown source/
        );
        assert.throws(
            () =>
                prefixStyle(
                    'o',
                    style([
                        { id: 'a', type: 'background' },
                        { id: 'a', type: 'background' },
                    ])
                ),
            /repeated layer id/
        );
    });
});

describe('ExtensionAPI v2', () => {
    it('adds the overlays of an extension, in the order of the list, hidden by default', () => {
        api.setOverlays('Heatmaps', [v2('b'), v2('a', { name: 'A' }), v2('c', { visible: true })]);

        const expected = [id('b'), id('a'), id('c')];
        assert.deepEqual(Object.keys(group(overlayTree)!), expected);
        assert.deepEqual(Object.keys(group(get(settings.selectedOverlayTree))!), expected);
        assert.deepEqual(group(get(settings.currentOverlays)), {
            [id('b')]: false,
            [id('a')]: false,
            [id('c')]: true,
        });
        assert.ok(get(api.isLayerFromExtension)(id('a')));
        assert.equal(get(api.getLayerName)(id('a')), 'A');
        assert.equal(api.version, 2);
    });

    it('uses the style as is, with prefixed ids', () => {
        api.setOverlays('Heatmaps', [v2('a')]);
        const style = overlays[id('a')] as StyleSpecification;
        assert.deepEqual(Object.keys(style.sources), [`${id('a')}/tiles`]);
        assert.equal(style.layers[0].id, `${id('a')}/tiles`);
        assert.equal((style.layers[0] as { source: string }).source, `${id('a')}/tiles`);
    });

    it('names its overlays after the extension, the way the v1 API does without it', () => {
        api.setOverlays('My heatmap', [v2('all')]);
        assert.ok(isSelected(overlayTree, 'extension-My%20heatmap/all'));
        api.setOverlays('My heatmap', []);
    });

    it('keeps two extensions with the same overlay ids, or similar names, apart', () => {
        api.setOverlays('Heatmaps', [v2('a')]);
        api.setOverlays('Other', [v2('a')]);
        assert.deepEqual(Object.keys(group(overlayTree)!), [id('a')]);
        assert.deepEqual(Object.keys(group(overlayTree, 'Other')!), [id('a', 'Other')]);

        api.setOverlays('Heatmaps/a', [v2('b')]);
        api.setOverlays('Heatmaps', [v2('a'), v2('a/b')]);
        assert.notEqual(id('a/b'), id('b', 'Heatmaps/a'));
        assert.ok(get(api.isLayerFromExtension)(id('a/b')));
        assert.ok(get(api.isLayerFromExtension)(id('b', 'Heatmaps/a')));

        api.setOverlays('Other', []);
        assert.deepEqual(Object.keys(group(overlayTree)!).length, 2);
        api.setOverlays('Heatmaps/a', []);
    });

    it('knows the groups of the extensions, of either version', () => {
        api.setOverlays('Heatmaps', [v2('a')]);
        api.addOrUpdateOverlay(overlay('one'));
        assert.equal(get(api.isExtensionGroup)('Heatmaps'), true);
        assert.equal(get(api.isExtensionGroup)('My extension'), true);
        assert.equal(get(api.isExtensionGroup)('france'), false);
        api.setOverlays('Heatmaps', []);
        assert.equal(get(api.isExtensionGroup)('Heatmaps'), false);
    });

    it('removes what is not in the list anymore, with its group when it is empty', () => {
        api.setOverlays('Heatmaps', [v2('a', { visible: true }), v2('b')]);
        api.setOverlays('Heatmaps', [v2('b')]);
        assert.ok(!(id('a') in overlays));
        assert.equal(get(api.isLayerFromExtension)(id('a')), false);
        assert.equal(isSelected(get(settings.currentOverlays)!, id('a')), false);
        assert.deepEqual(Object.keys(group(overlayTree)!), [id('b')]);

        api.setOverlays('Heatmaps', []);
        assert.equal(group(overlayTree), undefined);
        assert.equal(group(get(settings.selectedOverlayTree)), undefined);
        assert.equal(group(get(settings.currentOverlays)), undefined);
    });

    it('keeps the state of an overlay unless told otherwise, and the opacity and menu choices', () => {
        api.setOverlays('Heatmaps', [v2('a'), v2('b')]);
        setShown(id('a'), true);
        settings.opacities.update((opacities) => ({ ...opacities, [id('a')]: 0.3 }));
        settings.selectedOverlayTree.update((tree) => {
            group(tree)![id('b')] = false;
            return tree;
        });

        api.setOverlays('Heatmaps', [v2('b'), v2('a')]);
        assert.equal(isSelected(get(settings.currentOverlays)!, id('a')), true);
        assert.equal(isSelected(get(settings.selectedOverlayTree), id('b')), false);
        assert.equal(get(settings.opacities)[id('a')], 0.3);
        assert.deepEqual(Object.keys(group(get(settings.selectedOverlayTree))!), [
            id('b'),
            id('a'),
        ]);

        api.setOverlays('Heatmaps', [v2('a', { visible: false }), v2('b', { visible: true })]);
        assert.equal(isSelected(get(settings.currentOverlays)!, id('a')), false);
        // the user took it out of the menu, where it could not be hidden again
        assert.equal(isSelected(get(settings.currentOverlays)!, id('b')), false);
    });

    it('changes nothing when the list is not valid', () => {
        api.setOverlays('Heatmaps', [v2('a')]);
        const invalid: unknown[] = [
            [v2('b'), v2('b')],
            [v2('b'), { id: 'c', name: 'C' }],
            [v2('b'), { ...v2('c'), style: { version: 8, sources: {} } }],
            'not a list',
        ];
        for (const list of invalid) {
            assert.throws(() => api.setOverlays('Heatmaps', list as ExtensionOverlay[]));
        }
        assert.deepEqual(Object.keys(group(overlayTree)!), [id('a')]);
        assert.ok(!(id('b') in overlays));
    });

    it('refuses the names that cannot be the group of an extension', () => {
        for (const name of ['', 'world', 'countries', '__proto__']) {
            assert.throws(() => api.setOverlays(name, [v2('a')]));
        }
    });

    it('waits for the settings', () => {
        const current = get(settings.currentOverlays);
        (settings.currentOverlays as unknown as { _value: { set(v: unknown): void } })._value.set(
            undefined
        );
        assert.throws(() => api.setOverlays('Heatmaps', [v2('a')]), /gpxstudio\.ready/);
        settings.currentOverlays.set(current!);
    });

    it('tells the extension about the actions of the user only', () => {
        const calls: Record<string, boolean>[] = [];
        const stop = api.onVisibilityChange('Heatmaps', (visible) => calls.push(visible));
        const others: unknown[] = [];
        api.onVisibilityChange('Other', (visible) => others.push(visible));
        api.setOverlays('Other', [v2('x')]);

        api.setOverlays('Heatmaps', [v2('a'), v2('b', { visible: true })]);
        api.setOverlays('Heatmaps', [v2('a', { visible: true }), v2('b', { visible: false })]);
        assert.deepEqual(calls, []);

        setShown(id('b'), true);
        assert.deepEqual(calls, [{ a: true, b: true }]);
        // nothing changed
        setShown(id('b'), true);
        assert.equal(calls.length, 1);
        assert.deepEqual(others, []);

        stop();
        setShown(id('b'), false);
        assert.equal(calls.length, 1);
    });

    it('tells the extension when the overlays are all hidden from the menu', () => {
        const calls: Record<string, boolean>[] = [];
        api.onVisibilityChange('Heatmaps', (visible) => calls.push(visible));
        api.setOverlays('Heatmaps', [v2('a', { visible: true })]);
        settings.currentOverlays.set({ overlays: {} });
        assert.deepEqual(calls, [{ a: false }]);
    });

    it('survives a callback that throws, or that sets the overlays', () => {
        const error = console.error;
        console.error = () => {};
        const calls: unknown[] = [];
        api.onVisibilityChange('Heatmaps', () => {
            throw new Error('from the extension');
        });
        api.onVisibilityChange('Heatmaps', (visible) => {
            calls.push(visible);
            api.setOverlays('Heatmaps', [v2('a', { visible: visible.a })]);
        });
        api.setOverlays('Heatmaps', [v2('a')]);
        setShown(id('a'), true);
        console.error = error;
        assert.deepEqual(calls, [{ a: true }]);
    });

    it('does not tell the extension that all is hidden when the page closes', () => {
        const calls: unknown[] = [];
        api.onVisibilityChange('Heatmaps', (visible) => calls.push(visible));
        api.setOverlays('Heatmaps', [v2('a', { visible: true })]);
        (api as unknown as { destroy(): void }).destroy();
        assert.deepEqual(calls, []);
        assert.equal(isSelected(get(settings.currentOverlays)!, id('a')), false);
    });

    it('leaves a style URL for the map to fetch', () => {
        const fetchBefore = globalThis.fetch;
        globalThis.fetch = (() => assert.fail('fetched')) as typeof fetch;
        try {
            const url = 'https://example.com/style.json';
            api.setOverlays('Heatmaps', [v2('a', { style: url })]);
            assert.equal(overlays[id('a')], url);
        } finally {
            globalThis.fetch = fetchBefore;
        }
    });

    it('removes a style that changes from the map, layers first, but not one that stays', () => {
        const calls: string[] = [];
        const prefix = id('a');
        const fakeMap = {
            getStyle: () => ({
                sources: { [`${prefix}/tiles`]: {}, [`${prefix}2/tiles`]: {}, core: {} },
                layers: [{ id: `${prefix}/tiles` }, { id: `${prefix}2/tiles` }, { id: 'core' }],
            }),
            removeLayer: (layer: string) => calls.push(`layer ${layer}`),
            removeSource: (source: string) => calls.push(`source ${source}`),
        };
        const store = (map as unknown as { _mapStore: { set(value: unknown): void } })._mapStore;
        store.set(fakeMap);
        try {
            api.setOverlays('Heatmaps', [v2('a', { visible: true })]);
            api.setOverlays('Heatmaps', [v2('a', { name: 'Renamed' })]);
            assert.deepEqual(calls, []);

            api.setOverlays('Heatmaps', [v2('a', { style: rasterStyle('https://other/{z}') })]);
            assert.deepEqual(calls, [`layer ${prefix}/tiles`, `source ${prefix}/tiles`]);

            calls.length = 0;
            api.setOverlays('Heatmaps', [v2('a', { style: 'https://example.com/style.json' })]);
            assert.equal(calls.length, 2);

            calls.length = 0;
            api.setOverlays('Heatmaps', []);
            assert.equal(calls.length, 2);
        } finally {
            store.set(null);
        }
    });

    it('is not affected by the v1 API, and can live next to it', () => {
        api.setOverlays('Heatmaps', [v2('a')]);
        api.addOrUpdateOverlay(overlay('one', 'Heatmaps'));
        api.filterOverlays([]);
        assert.ok(id('a') in overlays);
        assert.ok(get(api.isLayerFromExtension)(id('a')));
        assert.ok(isSelected(overlayTree, id('a')));

        api.addOrUpdateOverlay(overlay('one', 'Heatmaps'));
        api.setOverlays('Heatmaps', [v2('a'), v2('b')]);
        assert.ok(isSelected(overlayTree, 'extension-one'));
        api.setOverlays('Heatmaps', []);
        assert.ok(isSelected(overlayTree, 'extension-one'));
    });
});
