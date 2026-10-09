import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LayerTreeType } from '$lib/assets/layers';
import { anySelectedLayer, getLayers, isSelected, remove, removeAll, toggle } from './utils';

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
