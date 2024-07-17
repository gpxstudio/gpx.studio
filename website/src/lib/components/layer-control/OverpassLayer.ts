import SphericalMercator from "@mapbox/sphericalmercator";
import { getLayers } from "./utils";
import mapboxgl from "mapbox-gl";
import { get, writable } from "svelte/store";
import { liveQuery } from "dexie";
import { db, settings } from "$lib/db";
import { overpassQueryData } from "$lib/assets/layers";

const {
    currentOverpassQueries
} = settings;

const mercator = new SphericalMercator({
    size: 256,
});

export const overpassPopupPOI = writable<Record<string, any> | null>(null);

export const overpassPopup = new mapboxgl.Popup({
    closeButton: false,
    maxWidth: undefined,
    offset: 15,
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
    nextQueries: Map<string, { x: number, y: number, queries: string[] }> = new Map();

    unsubscribes: (() => void)[] = [];
    queryIfNeededBinded = this.queryIfNeeded.bind(this);
    updateBinded = this.update.bind(this);
    onHoverBinded = this.onHover.bind(this);
    maybeHidePopupBinded = this.maybeHidePopup.bind(this);

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
                        'icon-image': ['get', 'icon'],
                        'icon-size': 0.25,
                    },
                });

                this.map.on('mouseenter', 'overpass', this.onHoverBinded);
                this.map.on('click', 'overpass', this.onHoverBinded);
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

    onHover(e: any) {
        overpassPopupPOI.set(e.features[0].properties);
        overpassPopup.setLngLat(e.features[0].geometry.coordinates);
        overpassPopup.addTo(this.map);
        this.map.on('mousemove', this.maybeHidePopupBinded);
    }

    maybeHidePopup(e: any) {
        let poi = get(overpassPopupPOI);
        if (poi && this.map.project([poi.lon, poi.lat]).dist(this.map.project(e.lngLat)) > 100) {
            this.hideWaypointPopup();
        }
    }

    hideWaypointPopup() {
        overpassPopupPOI.set(null);
        overpassPopup.remove();

        this.map.off('mousemove', this.maybeHidePopupBinded);
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
        if (this.currentQueries.size > 5) {
            return;
        }

        this.currentQueries.add(`${x},${y}`);

        const bounds = mercator.bbox(x, y, this.queryZoom);
        fetch(`${this.overpassUrl}?data=${getQueryForBounds(bounds, queries)}`)
            .then((response) => {
                if (response.ok) {
                    try {
                        return response.json();
                    } catch (e) { }
                }
                this.currentQueries.delete(`${x},${y}`);
                return Promise.reject();
            }, () => (this.currentQueries.delete(`${x},${y}`)))
            .then((data) => this.storeOverpassData(x, y, queries, data));
    }

    storeOverpassData(x: number, y: number, queries: string[], data: any) {
        let queryTiles = queries.map((query) => ({ x, y, query }));
        let pois: { query: string, id: number, poi: GeoJSON.Feature }[] = [];

        if (data.elements === undefined) {
            return;
        }

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
                                coordinates: element.center ? [element.center.lon, element.center.lat] : [element.lon, element.lat],
                            },
                            properties: {
                                id: element.id,
                                lat: element.center ? element.center.lat : element.lat,
                                lon: element.center ? element.center.lon : element.lon,
                                query: query,
                                icon: `overpass-${query}`,
                                tags: element.tags
                            },
                        }
                    });
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
            if (!this.map.hasImage(`overpass-${query}`)) {
                let icon = new Image(100, 100);
                icon.onload = () => {
                    if (!this.map.hasImage(`overpass-${query}`)) {
                        this.map.addImage(`overpass-${query}`, icon);
                    }
                }

                // Lucide icons are SVG files with a 24x24 viewBox
                // Create a new SVG with a 32x32 viewBox and center the icon in a circle
                icon.src = 'data:image/svg+xml,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="20" fill="${overpassQueryData[query].icon.color}" />
                    <g transform="translate(8 8)">
                    ${overpassQueryData[query].icon.svg.replace('stroke="currentColor"', 'stroke="white"')}
                    </g>
                </svg>
            `);
            }
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
    let arrayEntry = Object.entries(overpassQueryData[query].tags).find(([_, value]) => Array.isArray(value));
    if (arrayEntry !== undefined) {
        return arrayEntry[1].map((val) => `nwr${Object.entries(overpassQueryData[query].tags)
            .map(([tag, value]) => `[${tag}=${tag === arrayEntry[0] ? val : value}]`)
            .join('')};`).join('');
    } else {
        return `nwr${Object.entries(overpassQueryData[query].tags)
            .map(([tag, value]) => `[${tag}=${value}]`)
            .join('')};`;
    }
}

function belongsToQuery(element: any, query: string) {
    return Object.entries(overpassQueryData[query].tags)
        .every(([tag, value]) => Array.isArray(value) ? value.includes(element.tags[tag]) : element.tags[tag] === value);
}

function getCurrentQueries() {
    let currentQueries = get(currentOverpassQueries);
    if (currentQueries === undefined) {
        return [];
    }

    return Object.entries(getLayers(currentQueries)).filter(([_, selected]) => selected).map(([query, _]) => query);
}