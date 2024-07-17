import SphericalMercator from "@mapbox/sphericalmercator";
import { getLayers } from "./utils";
import mapboxgl from "mapbox-gl";
import { get, writable } from "svelte/store";
import { liveQuery } from "dexie";
import { db, settings } from "$lib/db";
import { overpassIcons, overpassQueries } from "$lib/assets/layers";

const {
    currentOverpassQueries
} = settings;

const mercator = new SphericalMercator({
    size: 256,
});

let data = writable<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });

liveQuery(() => db.overpassdata.toArray()).subscribe((pois) => {
    data.set({ type: 'FeatureCollection', features: pois.map((poi) => poi.poi) });
});

export class OverpassLayer {
    overpassUrl = 'https://overpass.private.coffee/api/interpreter';
    minZoom = 12;
    queryZoom = 12;
    map: mapboxgl.Map;

    currentQueries: Set<string> = new Set();

    unsubscribes: (() => void)[] = [];
    queryIfNeededBinded = this.queryIfNeeded.bind(this);
    updateBinded = this.update.bind(this);

    constructor(map: mapboxgl.Map) {
        this.map = map;
    }

    add() {
        this.map.on('moveend', this.queryIfNeededBinded);
        this.map.on('style.load', this.updateBinded);
        this.unsubscribes.push(data.subscribe(this.updateBinded));
        this.unsubscribes.push(currentOverpassQueries.subscribe(() => {
            this.updateBinded();
            this.queryIfNeededBinded();
        }));

        this.map.showTileBoundaries = true;

        this.update();
    }

    queryIfNeeded() {
        if (this.map.getZoom() >= this.minZoom) {
            const bounds = this.map.getBounds().toArray();
            this.query([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]]);
        }
    }

    update() {
        this.loadIcons();

        let d = get(data);

        try {
            let source = this.map.getSource('overpass');
            if (source) {
                source.setData(d);
            } else {
                this.map.addSource('overpass', {
                    type: 'geojson',
                    data: d,
                });
            }

            if (!this.map.getLayer('overpass')) {
                this.map.addLayer({
                    id: 'overpass',
                    type: 'symbol',
                    source: 'overpass',
                    layout: {
                        'icon-image': ['get', 'query'],
                        'icon-size': 0.25,
                    },
                });
            }

            this.map.setFilter('overpass', ['in', 'query', ...getCurrentQueries()]);
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
        }
    }

    remove() {
        this.map.off('moveend', this.queryIfNeededBinded);
        this.map.off('style.load', this.updateBinded);
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());

        if (this.map.getLayer('overpass')) {
            this.map.removeLayer('overpass');
        }

        if (this.map.getSource('overpass')) {
            this.map.removeSource('overpass');
        }
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

                db.overpassquerytiles.where('[x+y]').equals([x, y]).toArray().then((querytiles) => {
                    let missingQueries = queries.filter((query) => !querytiles.some((querytile) => querytile.query === query));
                    if (missingQueries.length > 0) {
                        this.queryTile(x, y, missingQueries);
                    }
                });
            }
        }
    }

    queryTile(x: number, y: number, queries: string[]) {
        this.currentQueries.add(`${x},${y}`);

        const bounds = mercator.bbox(x, y, this.queryZoom);
        fetch(`${this.overpassUrl}?data=${getQueryForBounds(bounds, queries)}`)
            .then((response) => response.json())
            .then((data) => this.storeOverpassData(x, y, queries, data));
    }

    storeOverpassData(x: number, y: number, queries: string[], data: any) {
        let queryTiles = queries.map((query) => ({ x, y, query }));
        let pois: { query: string, id: number, poi: GeoJSON.Feature }[] = [];

        for (let element of data.elements) {
            for (let query of queries) {
                if (belongsToQuery(element, query)) {
                    pois.push({
                        query,
                        id: element.id,
                        poi: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [element.lon, element.lat],
                            },
                            properties: { query, tags: element.tags },
                        }
                    });

                    break;
                }
            }
        }

        db.transaction('rw', db.overpassquerytiles, db.overpassdata, async () => {
            await db.overpassquerytiles.bulkPut(queryTiles);
            await db.overpassdata.bulkPut(pois);
        });

        this.currentQueries.delete(`${x},${y}`);
    }

    loadIcons() {
        let currentQueries = getCurrentQueries();
        currentQueries.forEach((query) => {
            if (!this.map.hasImage(query)) {
                let icon = new Image(100, 100);
                icon.onload = () => this.map.addImage(query, icon);

                // Lucide icons are SVG files with a 24x24 viewBox
                // Create a new SVG with a 32x32 viewBox and center the icon in a circle
                icon.src = 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="20" fill="${overpassIcons[query].color}" />
                    <g transform="translate(8 8)">
                    ${overpassIcons[query].svg.replace('stroke="currentColor"', 'stroke="white"')}
                    </g>
                </svg>
            `);
            }
        });
    }
}

function getQueryForBounds(bounds: [number, number, number, number], queries: string[]) {
    return `[bbox:${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}][out:json];(${getQueries(queries)});out;`;
}

function getQueries(queries: string[]) {
    return queries.map((query) => `node${getQuery(query)};`).join('');
}

function getQuery(query: string) {
    return Object.entries(overpassQueries[query])
        .map(([tag, value]) => value ? `[${tag}=${value}]` : `[${tag}]`)
        .join('');
}

function belongsToQuery(element: any, query: string) {
    return Object.entries(overpassQueries[query])
        .every(([tag, value]) => value ? element.tags[tag] === value : element.tags[tag]);
}

function getCurrentQueries() {
    let currentQueries = get(currentOverpassQueries);
    if (currentQueries === undefined) {
        return [];
    }

    return Object.entries(getLayers(currentQueries)).filter(([_, selected]) => selected).map(([query, _]) => query);
}