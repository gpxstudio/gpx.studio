import { SphericalMercator } from '@mapbox/sphericalmercator';
import { getLayers } from './utils';
import { get, writable } from 'svelte/store';
import { overpassQueryData } from '$lib/assets/layers';
import { MapPopup } from '$lib/components/map/map-popup';
import { settings } from '$lib/logic/settings';
import type { GeoJSONSource } from 'maplibre-gl';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import type { MapLayerEventManager } from '$lib/components/map/map-layer-event-manager';
import { loadSVGIcon } from '$lib/utils';
import { cachedFetch } from '$lib/cached-fetch';

const { currentOverpassQueries } = settings;

/** The responses of Overpass are kept in the browser for a week. */
const CACHE = { name: 'overpass', maxAge: 7 * 24 * 3600 * 1000 };

const mercator = new SphericalMercator({
    size: 256,
});

export class OverpassLayer {
    overpassUrl = 'https://overpass.gpx.studio/api/interpreter';
    minZoom = 12;
    queryZoom = 12;
    map: maplibregl.Map;
    layerEventManager: MapLayerEventManager;
    popup: MapPopup;

    data = writable<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });

    // What was queried this session: the queries that were made for each tile. The responses are
    // kept longer, see `cachedFetch`.
    queriedTiles = new Map<string, Set<string>>();
    currentQueries: Set<string> = new Set();

    unsubscribes: (() => void)[] = [];
    queryIfNeededBinded = this.queryIfNeeded.bind(this);
    updateBinded = this.update.bind(this);
    onHoverBinded = this.onHover.bind(this);

    constructor(map: maplibregl.Map, layerEventManager: MapLayerEventManager) {
        this.map = map;
        this.layerEventManager = layerEventManager;
        this.popup = new MapPopup(map, {
            closeButton: false,
            focusAfterOpen: false,
            maxWidth: undefined,
            offset: 15,
        });
    }

    add() {
        this.map.on('moveend', this.queryIfNeededBinded);
        this.map.on('style.load', this.updateBinded);
        this.unsubscribes.push(this.data.subscribe(this.updateBinded));
        this.unsubscribes.push(
            currentOverpassQueries.subscribe(() => {
                this.updateBinded();
                this.queryIfNeededBinded();
            })
        );

        this.update();
    }

    queryIfNeeded() {
        if (this.map.getZoom() >= this.minZoom) {
            const bounds = this.map.getBounds()?.toArray();
            if (bounds) {
                this.query([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]]);
            }
        }
    }

    update() {
        this.loadIcons();

        const fullData = get(this.data);
        const queries = getCurrentQueries();
        const d: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: fullData.features.filter((feature) =>
                queries.includes(feature.properties!.query)
            ),
        };

        try {
            let source = this.map.getSource('overpass') as GeoJSONSource | undefined;
            if (source) {
                source.setData(d);
            } else {
                this.map.addSource('overpass', {
                    type: 'geojson',
                    data: d,
                });
            }

            if (!this.map.getLayer('overpass')) {
                this.map.addLayer(
                    {
                        id: 'overpass',
                        type: 'symbol',
                        source: 'overpass',
                        layout: {
                            'icon-image': ['get', 'icon'],
                            'icon-size': 0.25,
                            'icon-padding': 0,
                            'icon-allow-overlap': ['step', ['zoom'], false, 14, true],
                        },
                    },
                    ANCHOR_LAYER_KEY.overpass
                );

                this.layerEventManager.on('mouseenter', 'overpass', this.onHoverBinded);
                this.layerEventManager.on('click', 'overpass', this.onHoverBinded);
            }
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
        }
    }

    remove() {
        this.map.off('moveend', this.queryIfNeededBinded);
        this.map.off('style.load', this.updateBinded);
        this.layerEventManager.off('mouseenter', 'overpass', this.onHoverBinded);
        this.layerEventManager.off('click', 'overpass', this.onHoverBinded);
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());

        try {
            if (this.map.getLayer('overpass')) {
                this.map.removeLayer('overpass');
            }

            if (this.map.getSource('overpass')) {
                this.map.removeSource('overpass');
            }
        } catch (e) {
            // No reliable way to check if the map is ready to remove sources and layers
        }
    }

    onHover(e: any) {
        this.popup.setItem({
            kind: 'overpass',
            item: {
                ...e.features[0].properties,
                sym: overpassQueryData[e.features[0].properties.query].symbol ?? '',
            },
        });
    }

    query(bbox: [number, number, number, number]) {
        let queries = getCurrentQueries();
        if (queries.length === 0) {
            return;
        }

        let tileLimits = mercator.xyz(bbox, this.queryZoom);

        for (let x = tileLimits.minX; x <= tileLimits.maxX; x++) {
            for (let y = tileLimits.minY; y <= tileLimits.maxY; y++) {
                if (this.currentQueries.has(`${x},${y}`)) {
                    continue;
                }

                const queried = this.queriedTiles.get(`${x},${y}`);
                const missingQueries = queries.filter((query) => !queried?.has(query));
                if (missingQueries.length > 0) {
                    this.queryTile(x, y, missingQueries);
                }
            }
        }
    }

    queryTile(x: number, y: number, queries: string[]) {
        this.currentQueries.add(`${x},${y}`);

        const bounds = mercator.bbox(x, y, this.queryZoom);
        cachedFetch(`${this.overpassUrl}?data=${getQueryForBounds(bounds, queries)}`, CACHE)
            .then((response) => (response.ok ? response.json() : Promise.reject()))
            .then((data) => this.storeOverpassData(x, y, queries, data))
            .catch(() => this.currentQueries.delete(`${x},${y}`));
    }

    storeOverpassData(x: number, y: number, queries: string[], data: any) {
        if (data.elements === undefined) {
            return;
        }

        this.data.update((updatedData) => {
            for (let element of data.elements) {
                for (let query of queries) {
                    if (belongsToQuery(element, query)) {
                        updatedData.features.push({
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: element.center
                                    ? [element.center.lon, element.center.lat]
                                    : [element.lon, element.lat],
                            },
                            properties: {
                                id: element.id,
                                lat: element.center ? element.center.lat : element.lat,
                                lng: element.center ? element.center.lon : element.lon,
                                query: query,
                                icon: `overpass-${query}`,
                                tags: element.tags,
                                type: element.type,
                            },
                        });
                    }
                }
            }
            return updatedData;
        });

        const queried = this.queriedTiles.get(`${x},${y}`) ?? new Set<string>();
        queries.forEach((query) => queried.add(query));
        this.queriedTiles.set(`${x},${y}`, queried);

        this.currentQueries.delete(`${x},${y}`);
    }

    loadIcons() {
        let currentQueries = getCurrentQueries();
        currentQueries.forEach((query) => {
            loadSVGIcon(
                this.map,
                `overpass-${query}`,
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="20" fill="${overpassQueryData[query].icon.color}" />
                    <g transform="translate(8 8)">
                    ${overpassQueryData[query].icon.svg.replace('stroke="currentColor"', 'stroke="white"')}
                    </g>
                </svg>`
            );
        });
    }
}

function getQueryForBounds(bounds: [number, number, number, number], queries: string[]) {
    return `[bbox:${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}][out:json];(${getQueries(queries)});out center;`;
}

function getQueries(queries: string[]) {
    return queries.map((query) => getQuery(query)).join('');
}

function getQuery(query: string) {
    if (Array.isArray(overpassQueryData[query].tags)) {
        return overpassQueryData[query].tags.map((tags) => getQueryItem(tags)).join('');
    } else {
        return getQueryItem(overpassQueryData[query].tags);
    }
}

function getQueryItem(tags: Record<string, string | string[]>) {
    let arrayEntry = Object.entries(tags).find((entry): entry is [string, string[]] =>
        Array.isArray(entry[1])
    );
    if (arrayEntry !== undefined) {
        return arrayEntry[1]
            .map(
                (val) =>
                    `nwr${Object.entries(tags)
                        .map(([tag, value]) => `[${tag}=${tag === arrayEntry[0] ? val : value}]`)
                        .join('')};`
            )
            .join('');
    } else {
        return `nwr${Object.entries(tags)
            .map(([tag, value]) => `[${tag}=${value}]`)
            .join('')};`;
    }
}

function belongsToQuery(element: any, query: string) {
    if (Array.isArray(overpassQueryData[query].tags)) {
        return overpassQueryData[query].tags.some((tags) => belongsToQueryItem(element, tags));
    } else {
        return belongsToQueryItem(element, overpassQueryData[query].tags);
    }
}

function belongsToQueryItem(element: any, tags: Record<string, string | string[]>) {
    return Object.entries(tags).every(([tag, value]) =>
        Array.isArray(value) ? value.includes(element.tags[tag]) : element.tags[tag] === value
    );
}

function getCurrentQueries() {
    let currentQueries = get(currentOverpassQueries);
    if (currentQueries === undefined) {
        return [];
    }

    return Object.entries(getLayers(currentQueries))
        .filter(([_, selected]) => selected)
        .map(([query, _]) => query);
}
