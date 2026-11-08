// The API that browser extensions use to add overlays to the map (`window.gpxstudio`).
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { get } from 'svelte/store';
import { overlays, overlayTree, type LayerTreeType } from '$lib/data/layers';
import { engine } from '$lib/engine';
import { settings } from '$lib/state/settings';
import { ExtensionAPI, type CustomOverlay } from './extension-api';
import { isSelected } from './utils';

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
