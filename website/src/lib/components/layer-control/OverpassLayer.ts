import { type LayerTreeType } from "$lib/assets/layers";
import SphericalMercator from "@mapbox/sphericalmercator";
import { getLayers } from "./utils";
import mapboxgl from "mapbox-gl";
import { get, writable } from "svelte/store";
import { liveQuery } from "dexie";
import { db } from "$lib/db";

const poiSelection: LayerTreeType = {
    transport: {
        tram: true,
    },
};

type PoiQuery = Record<string, string | undefined>;

const poiQueries: Record<string, PoiQuery> = {
    tram: {
        railway: 'tram_stop',
    },
};

const mercator = new SphericalMercator({
    size: 256,
});

let data = writable<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });

liveQuery(() => db.overpassdata.toArray()).subscribe((pois) => {
    data.set({ type: 'FeatureCollection', features: pois.map((poi) => poi.poi) });
});

export class OverpassLayer {
    overpassUrl = 'https://overpass-api.de/api/interpreter';
    minZoom = 12;
    queryZoom = 14;
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
                        'text-field': ['get', 'name'],
                        'text-allow-overlap': true,
                    },
                    paint: {
                        'text-color': 'black',
                    }
                });
            }
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
        let layers = getLayers(poiSelection);
        let tileLimits = mercator.xyz(bbox, this.queryZoom);

        for (let x = tileLimits.minX; x <= tileLimits.maxX; x++) {
            for (let y = tileLimits.minY; y <= tileLimits.maxY; y++) {
                if (this.currentQueries.has(`${x},${y}`)) {
                    continue;
                }

                db.overpasslayertiles.where('[x+y]').equals([x, y]).toArray().then((layertiles) => {
                    let missingLayers = Object.keys(layers).filter((layer) => !layertiles.some((layertile) => layertile.layer === layer));
                    if (missingLayers.length > 0) {
                        this.queryTileForLayers(x, y, missingLayers);
                    }
                });
            }
        }
    }

    queryTileForLayers(x: number, y: number, layers: string[]) {
        this.currentQueries.add(`${x},${y}`);

        const bounds = mercator.bbox(x, y, this.queryZoom);
        fetch(`${this.overpassUrl}?data=${getQueryForBoundsAndLayers(bounds, layers)}`)
            .then((response) => response.json())
            .then((data) => this.storeOverpassData(x, y, layers, data));
    }

    storeOverpassData(x: number, y: number, layers: string[], data: any) {
        let layerTiles = layers.map((layer) => ({ x, y, layer }));
        let pois: { layer: string, id: number, poi: GeoJSON.Feature }[] = [];

        for (let element of data.elements) {
            for (let layer of layers) {
                if (belongsToLayer(element, layer)) {
                    pois.push({
                        layer,
                        id: element.id,
                        poi: {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [element.lon, element.lat],
                            },
                            properties: { ...element.tags, layer }
                        }
                    });

                    break;
                }
            }
        }

        db.transaction('rw', db.overpasslayertiles, db.overpassdata, async () => {
            await db.overpasslayertiles.bulkPut(layerTiles);
            await db.overpassdata.bulkPut(pois);
        });

        this.currentQueries.delete(`${x},${y}`);
    }
}

function getQueryForBoundsAndLayers(bounds: [number, number, number, number], layers: string[]) {
    return `[bbox:${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}][out:json];(${getQueryForLayers(layers)});out;`;
}

function getQueryForLayers(layers: string[]) {
    return layers.map((layer) => `node${getQueryForLayer(layer)};`).join('');
}

function getQueryForLayer(layer: string) {
    return Object.entries(poiQueries[layer])
        .map(([tag, value]) => value ? `[${tag}=${value}]` : `[${tag}]`)
        .join('');
}

function belongsToLayer(element: any, layer: string) {
    return Object.entries(poiQueries[layer])
        .every(([tag, value]) => value ? element.tags[tag] === value : element.tags[tag]);
}