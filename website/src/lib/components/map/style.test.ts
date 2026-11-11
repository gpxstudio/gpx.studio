// How the map shows the overlays: here, those of extensions that give the URL of their style.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { writable } from 'svelte/store';
import { overlays, type LayerTreeType } from '$lib/data/layers';
import { engine } from '$lib/engine';
import { settings } from '$lib/state/settings';
import { StyleManager } from './style';

const URL_A = 'https://example.com/a.json';
const URL_B = 'https://example.com/b.json';
const ID = 'extension-Heatmaps/a';

const style = (tiles: string): StyleSpecification => ({
    version: 8,
    sources: { tiles: { type: 'raster', tiles: [tiles], tileSize: 256 } },
    layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }],
});

const original = {
    set: engine.setSetting,
    delete: engine.deleteSetting,
    fetch: globalThis.fetch,
    error: console.error,
};

/** A map that only knows of its overlays. */
function fakeMap() {
    const sources = new Map<string, { tiles: string[] }>([['empty-source', { tiles: [] }]]);
    const layers = new Map<string, { source: string; paint: Record<string, unknown> }>();
    return {
        sources,
        layers,
        on: () => {},
        setStyle: () => {},
        getPitch: () => 0,
        getTerrain: () => null,
        setTerrain: () => {},
        getSource: (id: string) => sources.get(id),
        addSource: (id: string, source: { tiles: string[] }) => sources.set(id, source),
        getLayer: (id: string) => layers.get(id),
        addLayer: (layer: { id: string; source: string; paint: Record<string, unknown> }) =>
            layers.set(layer.id, layer),
        removeLayer: (id: string) => layers.delete(id),
        setPaintProperty: (id: string, name: string, value: unknown) => {
            layers.get(id)!.paint[name] = value;
        },
    };
}

/** Shows the overlay, and gives the manager of the map. */
function setUp(fake: ReturnType<typeof fakeMap>) {
    settings.currentOverlays.update((tree) => {
        (tree.overlays as LayerTreeType).Heatmaps = { [ID]: true };
        return tree;
    });
    const store = writable<MapLibreMap | null>(null);
    const manager = new StyleManager(store, '');
    store.set(fake as unknown as MapLibreMap);
    return manager;
}

beforeEach(() => {
    engine.setSetting = () => {};
    engine.deleteSetting = () => {};
    settings.connect({});
    settings.initialize();
});

afterEach(() => {
    delete overlays[ID];
    delete overlays.plainUrl;
    settings.currentOverlays.update((tree) => {
        delete (tree.overlays as LayerTreeType).Heatmaps;
        delete (tree.overlays as LayerTreeType).plainUrl;
        return tree;
    });
    engine.setSetting = original.set;
    engine.deleteSetting = original.delete;
    globalThis.fetch = original.fetch;
    console.error = original.error;
});

/** Answers the style requests with the styles of `responses`, by URL. */
function answerWith(responses: Record<string, StyleSpecification>) {
    globalThis.fetch = (async (url: string) =>
        Object.hasOwn(responses, url)
            ? new Response(JSON.stringify(responses[url]))
            : new Response(JSON.stringify(style('https://basemap/{z}')))) as typeof fetch;
}

describe('StyleManager, with the style URL of an extension', () => {
    it('fetches it, and prefixes the ids of its sources and layers', async () => {
        answerWith({ [URL_A]: style('https://a/{z}') });
        overlays[ID] = URL_A;
        const fake = fakeMap();
        await setUp(fake).updateOverlays();

        assert.deepEqual(fake.sources.get(`${ID}/tiles`)?.tiles, ['https://a/{z}']);
        assert.equal(fake.layers.get(`${ID}/tiles`)?.source, `${ID}/tiles`);
        assert.ok(!fake.sources.has('tiles'));
    });

    it('uses the opacity of the overlay', async () => {
        answerWith({ [URL_A]: style('https://a/{z}') });
        overlays[ID] = URL_A;
        settings.opacities.update((opacities) => ({ ...opacities, [ID]: 0.3 }));
        const fake = fakeMap();
        await setUp(fake).updateOverlays();
        assert.equal(fake.layers.get(`${ID}/tiles`)?.paint['raster-opacity'], 0.3);
    });

    it('removes its layers when it is hidden', async () => {
        answerWith({ [URL_A]: style('https://a/{z}') });
        overlays[ID] = URL_A;
        const fake = fakeMap();
        const manager = setUp(fake);
        await manager.updateOverlays();
        assert.ok(fake.layers.has(`${ID}/tiles`));

        settings.currentOverlays.update((tree) => {
            (tree.overlays as LayerTreeType).Heatmaps = { [ID]: false };
            return tree;
        });
        await manager.updateOverlays();
        assert.ok(!fake.layers.has(`${ID}/tiles`));
    });

    it('does not fetch it while the overlay is hidden', async () => {
        const urls: string[] = [];
        answerWith({});
        const answer = globalThis.fetch;
        globalThis.fetch = ((url: string) => {
            urls.push(url);
            return answer(url);
        }) as typeof fetch;
        overlays[ID] = URL_A;
        settings.currentOverlays.update((tree) => {
            (tree.overlays as LayerTreeType).Heatmaps = { [ID]: false };
            return tree;
        });
        const store = writable<MapLibreMap | null>(null);
        const manager = new StyleManager(store, '');
        store.set(fakeMap() as unknown as MapLibreMap);
        await manager.updateOverlays();
        assert.ok(!urls.includes(URL_A));
    });

    it('ignores a style that was replaced or removed while it was fetched', async () => {
        for (const next of [URL_B, undefined]) {
            let respond: (response: Response) => void = () => {};
            const answers: Record<string, StyleSpecification> = {
                [URL_B]: style('https://b/{z}'),
            };
            answerWith(answers);
            const answer = globalThis.fetch;
            globalThis.fetch = ((url: string) =>
                url === URL_A
                    ? new Promise((resolve) => (respond = resolve))
                    : answer(url)) as typeof fetch;

            overlays[ID] = URL_A;
            const fake = fakeMap();
            const manager = setUp(fake);
            const pending = manager.updateOverlays();
            await new Promise((resolve) => setTimeout(resolve));
            if (next) {
                overlays[ID] = next;
            } else {
                delete overlays[ID];
            }
            respond(new Response(JSON.stringify(style('https://a/{z}'))));
            await pending;
            assert.ok(!fake.sources.has(`${ID}/tiles`));

            await manager.updateOverlays();
            assert.deepEqual(
                fake.sources.get(`${ID}/tiles`)?.tiles,
                next ? ['https://b/{z}'] : undefined
            );
        }
    });

    it('logs a style that cannot be used, which leaves the others alone', async () => {
        const logged: unknown[] = [];
        console.error = (...args) => logged.push(args);
        for (const answer of [
            new Response('', { status: 404 }),
            new Response(JSON.stringify({ version: 8, sources: {} })),
        ]) {
            answerWith({});
            const basemap = globalThis.fetch;
            globalThis.fetch = ((url: string) =>
                url === URL_A ? Promise.resolve(answer.clone()) : basemap(url)) as typeof fetch;
            overlays[ID] = URL_A;
            const fake = fakeMap();
            logged.length = 0;
            await setUp(fake).updateOverlays();
            assert.ok(logged.length > 0);
            assert.equal(fake.layers.size, 0);
        }
    });

    it('does not prefix the style URL of anything else', async () => {
        answerWith({ [URL_A]: style('https://a/{z}') });
        overlays.plainUrl = URL_A;
        settings.currentOverlays.update((tree) => {
            (tree.overlays as LayerTreeType).plainUrl = { plainUrl: true };
            return tree;
        });
        const fake = fakeMap();
        const store = writable<MapLibreMap | null>(null);
        const manager = new StyleManager(store, '');
        store.set(fake as unknown as MapLibreMap);
        await manager.updateOverlays();
        assert.ok(fake.sources.has('tiles'));
        assert.ok(fake.layers.has('tiles'));
    });
});
