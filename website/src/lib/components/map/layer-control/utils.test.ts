import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LayerTreeType } from '$lib/data/layers';
import type { LayerSpecification } from 'maplibre-gl';
import {
    anySelectedLayer,
    getLayers,
    getOpacityPaint,
    isSelected,
    remove,
    removeAll,
    toggle,
} from './utils';

// roads: bike (selected), foot
// satellite: esri, ign: fr (selected)
// osm
const tree = (): LayerTreeType => ({
    roads: { bike: true, foot: false },
    satellite: { esri: false, ign: { fr: true } },
    osm: false,
});

describe('layer trees', () => {
    it('tells if a layer is selected', () => {
        assert.equal(isSelected(tree(), 'bike'), true);
        assert.equal(isSelected(tree(), 'foot'), false);
        assert.equal(isSelected(tree(), 'fr'), true);
        assert.equal(isSelected(tree(), 'osm'), false);
        assert.equal(isSelected(tree(), 'unknown'), false);
    });

    it('tells if anything is selected in a branch', () => {
        const t = tree();
        assert.equal(anySelectedLayer(t), true);
        assert.equal(anySelectedLayer(t.roads as LayerTreeType), true);
        assert.equal(anySelectedLayer(t.satellite as LayerTreeType), true);
        assert.equal(anySelectedLayer({ a: false, b: { c: false } }), false);
        assert.equal(anySelectedLayer({}), false);
    });

    it('flattens the layers of the leaves', () => {
        assert.deepEqual(getLayers(tree()), {
            bike: true,
            foot: false,
            esri: false,
            fr: true,
            osm: false,
        });
        assert.deepEqual(getLayers({}), {});
    });

    it('toggles a layer wherever it is', () => {
        const t = toggle(tree(), 'fr');
        assert.equal(isSelected(t, 'fr'), false);
        assert.equal(isSelected(toggle(t, 'osm'), 'osm'), true);
        assert.equal(isSelected(toggle(t, 'osm'), 'bike'), true);
        // the tree is edited, and returned
        const own = tree();
        assert.equal(toggle(own, 'foot'), own);
        assert.equal((own.roads as LayerTreeType).foot, true);
        // an id that is not there changes nothing
        assert.deepEqual(toggle(tree(), 'unknown'), tree());
    });

    it('removes layers and branches', () => {
        assert.deepEqual(remove(tree(), 'bike'), {
            roads: { foot: false },
            satellite: { esri: false, ign: { fr: true } },
            osm: false,
        });
        assert.deepEqual(remove(tree(), 'ign'), {
            roads: { bike: true, foot: false },
            satellite: { esri: false },
            osm: false,
        });
        assert.deepEqual(removeAll(tree(), ['bike', 'fr', 'osm']), {
            roads: { foot: false },
            satellite: { esri: false, ign: {} },
        });
        assert.deepEqual(removeAll(tree(), []), tree());
    });
});

describe('getOpacityPaint', () => {
    const layer = (type: string, paint?: Record<string, unknown>) =>
        ({ id: 'layer', type, source: 'source', paint }) as LayerSpecification;

    it('uses the opacity properties of each type of layer', () => {
        assert.deepEqual(getOpacityPaint(layer('raster'), 0.5), { 'raster-opacity': 0.5 });
        assert.deepEqual(getOpacityPaint(layer('color-relief'), 0.5), {
            'color-relief-opacity': 0.5,
        });
        assert.deepEqual(getOpacityPaint(layer('symbol'), 0.5), {
            'icon-opacity': 0.5,
            'text-opacity': 0.5,
        });
        assert.deepEqual(getOpacityPaint(layer('circle'), 0.5), {
            'circle-opacity': 0.5,
            'circle-stroke-opacity': 0.5,
        });
        assert.deepEqual(getOpacityPaint(layer('hillshade'), 0.5), {
            'hillshade-exaggeration': 0.25,
        });
    });

    it('scales the opacity that the layer already has', () => {
        assert.deepEqual(getOpacityPaint(layer('line', { 'line-opacity': 0.5 }), 0.5), {
            'line-opacity': 0.25,
        });
    });

    it('replaces an expression, unless the opacity is left at 1', () => {
        const expression = ['interpolate', ['linear'], ['zoom'], 5, 0, 10, 1];
        const paint = { 'fill-opacity': expression };
        assert.deepEqual(getOpacityPaint(layer('fill', paint), 0.5), { 'fill-opacity': 0.5 });
        assert.deepEqual(getOpacityPaint(layer('fill', paint), 1), { 'fill-opacity': expression });
    });
});
