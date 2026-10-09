// The layers are plain data, which the settings and the menus rely on being consistent.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    basemaps,
    basemapTree,
    defaultBasemap,
    defaultBasemapTree,
    defaultOpacities,
    defaultOverlays,
    defaultOverlayTree,
    defaultOverpassQueries,
    defaultOverpassTree,
    defaultTerrainSource,
    overlays,
    overlayTree,
    overpassQueryData,
    overpassTree,
    terrainSources,
    type LayerTreeType,
} from './layers';
import { getLayers } from '$lib/components/map/layer-control/utils';

const leaves = (tree: LayerTreeType) => Object.keys(getLayers(tree));

describe('layers', () => {
    it('has a basemap and an overlay for every leaf of their trees', () => {
        for (const id of leaves(basemapTree)) assert.ok(id in basemaps, `basemap ${id}`);
        for (const id of leaves(overlayTree)) assert.ok(id in overlays, `overlay ${id}`);
        for (const id of leaves(overpassTree)) assert.ok(id in overpassQueryData, `query ${id}`);
    });

    it('offers every layer and every query in its trees', () => {
        const missingFrom = (ids: string[], tree: LayerTreeType) => {
            const offered = new Set(leaves(tree));
            return ids.filter((id) => !offered.has(id));
        };
        const basemapIds = Object.keys(basemaps);
        assert.deepEqual(missingFrom(basemapIds, basemapTree), [], 'basemapTree');
        assert.deepEqual(missingFrom(basemapIds, defaultBasemapTree), [], 'defaultBasemapTree');
        const overlayIds = Object.keys(overlays);
        assert.deepEqual(missingFrom(overlayIds, overlayTree), [], 'overlayTree');
        assert.deepEqual(missingFrom(overlayIds, defaultOverlayTree), [], 'defaultOverlayTree');
        const queryIds = Object.keys(overpassQueryData);
        assert.deepEqual(missingFrom(queryIds, overpassTree), [], 'overpassTree');
        assert.deepEqual(missingFrom(queryIds, defaultOverpassTree), [], 'defaultOverpassTree');
        assert.deepEqual(
            missingFrom(queryIds, defaultOverpassQueries),
            [],
            'defaultOverpassQueries'
        );
    });

    it('only offers by default what exists', () => {
        assert.ok(defaultBasemap in basemaps);
        for (const id of leaves(defaultBasemapTree)) assert.ok(id in basemaps, `basemap ${id}`);
        for (const id of leaves(defaultOverlayTree)) assert.ok(id in overlays, `overlay ${id}`);
        for (const id of leaves(defaultOverpassTree)) assert.ok(id in overpassQueryData, `${id}`);
        for (const id of leaves(defaultOverlays)) assert.ok(id in overlays, `overlay ${id}`);
        for (const id of leaves(defaultOverpassQueries)) {
            assert.ok(id in overpassQueryData, `query ${id}`);
        }
        assert.ok(defaultTerrainSource in terrainSources);
    });

    it('has the default selections inside the default trees', () => {
        const inTree = (selection: LayerTreeType, tree: LayerTreeType) => {
            const offered = new Set(leaves(tree));
            for (const id of leaves(selection)) assert.ok(offered.has(id), `${id}`);
        };
        inTree(defaultOverlays, defaultOverlayTree);
        inTree(defaultOverpassQueries, defaultOverpassTree);
    });

    it('has the default tree inside the whole tree', () => {
        const all = new Set(leaves(basemapTree));
        for (const id of leaves(defaultBasemapTree)) assert.ok(all.has(id), `${id}`);
    });

    it('has no id used by two leaves of a tree', () => {
        for (const tree of [basemapTree, overlayTree, overpassTree, defaultBasemapTree]) {
            const ids: string[] = [];
            const walk = (node: LayerTreeType) =>
                Object.entries(node).forEach(([id, value]) =>
                    typeof value === 'boolean' ? ids.push(id) : walk(value)
                );
            walk(tree);
            assert.equal(new Set(ids).size, ids.length);
        }
    });

    it('has opacities between 0 and 1, for overlays', () => {
        for (const [id, opacity] of Object.entries(defaultOpacities)) {
            assert.ok(opacity >= 0 && opacity <= 1, id);
        }
    });

    it('has the queries it needs', () => {
        for (const [id, data] of Object.entries(overpassQueryData)) {
            assert.ok(Object.keys(data).length > 0, id);
        }
    });
});
