import { settings } from '$lib/logic/settings';
import { get, type Writable } from 'svelte/store';
import {
    basemaps,
    defaultBasemap,
    maptilerKeyPlaceHolder,
    overlays,
    terrainSources,
} from '$lib/assets/layers';
import { customBasemapUpdate, getLayers } from '$lib/components/map/layer-control/utils';
import { i18n } from '$lib/i18n.svelte';

const { currentBasemap, currentOverlays, customLayers, opacities, terrainSource } = settings;

const emptySource: maplibregl.GeoJSONSourceSpecification = {
    type: 'geojson',
    data: {
        type: 'FeatureCollection',
        features: [],
    },
};
export const ANCHOR_LAYER_KEY = {
    overlays: 'overlays-end',
    mapillary: 'mapillary-end',
    tracks: 'tracks-end',
    directionMarkers: 'direction-markers-end',
    distanceMarkers: 'distance-markers-end',
    interactions: 'interactions-end',
    overpass: 'overpass-end',
    waypoints: 'waypoints-end',
};
const anchorLayers: maplibregl.LayerSpecification[] = Object.values(ANCHOR_LAYER_KEY).map((id) => ({
    id: id,
    type: 'symbol',
    source: 'empty-source',
}));

export class StyleManager {
    private _map: Writable<maplibregl.Map | null>;
    private _maptilerKey: string;
    private _pastOverlays: Set<string> = new Set();

    constructor(map: Writable<maplibregl.Map | null>, maptilerKey: string) {
        this._map = map;
        this._maptilerKey = maptilerKey;
        this._map.subscribe((map_) => {
            if (map_) {
                this.updateBasemap();
                map_.on('style.load', () => this.updateOverlays());
                map_.on('pitch', () => this.updateTerrain());
            }
        });
        currentBasemap.subscribe(() => this.updateBasemap());
        customBasemapUpdate.subscribe(() => this.updateBasemap());
        currentOverlays.subscribe(() => this.updateOverlays());
        opacities.subscribe(() => this.updateOverlays());
        terrainSource.subscribe(() => this.updateTerrain());
    }

    updateBasemap() {
        const map_ = get(this._map);
        if (!map_) return;
        this.buildStyle().then((style) => map_.setStyle(style));
    }

    async buildStyle(): Promise<maplibregl.StyleSpecification> {
        const custom = get(customLayers);

        const style: maplibregl.StyleSpecification = {
            version: 8,
            projection: {
                type: 'globe',
            },
            sources: {
                'empty-source': emptySource,
            },
            layers: [],
        };

        let basemap = get(currentBasemap);
        const basemapInfo = basemaps[basemap] ?? custom[basemap]?.value ?? basemaps[defaultBasemap];
        const basemapStyle = await this.get(basemapInfo);

        this.merge(style, basemapStyle);

        const terrain = this.getCurrentTerrain();
        style.sources[terrain.source] = terrainSources[terrain.source];
        style.terrain = terrain.exaggeration > 0 ? terrain : undefined;

        style.layers.push(...anchorLayers);

        return style;
    }

    async updateOverlays() {
        const map_ = get(this._map);
        if (!map_) return;
        if (!map_.getSource('empty-source')) return;

        const custom = get(customLayers);
        const overlayOpacities = get(opacities);
        try {
            const layers = getLayers(get(currentOverlays) ?? {});
            for (let overlay in layers) {
                if (!layers[overlay]) {
                    if (this._pastOverlays.has(overlay)) {
                        const overlayInfo = custom[overlay]?.value ?? overlays[overlay];
                        const overlayStyle = await this.get(overlayInfo);
                        for (let layer of overlayStyle.layers ?? []) {
                            if (map_.getLayer(layer.id)) {
                                map_.removeLayer(layer.id);
                            }
                        }
                        this._pastOverlays.delete(overlay);
                    }
                } else {
                    const overlayInfo = custom[overlay]?.value ?? overlays[overlay];
                    const overlayStyle = await this.get(overlayInfo);
                    const opacity = overlayOpacities[overlay];

                    for (let sourceId in overlayStyle.sources) {
                        if (!map_.getSource(sourceId)) {
                            map_.addSource(sourceId, overlayStyle.sources[sourceId]);
                        }
                    }

                    for (let layer of overlayStyle.layers ?? []) {
                        if (!map_.getLayer(layer.id)) {
                            if (opacity !== undefined) {
                                if (layer.type === 'raster') {
                                    if (!layer.paint) {
                                        layer.paint = {};
                                    }
                                    layer.paint['raster-opacity'] = opacity;
                                } else if (layer.type === 'hillshade') {
                                    if (!layer.paint) {
                                        layer.paint = {};
                                    }
                                    layer.paint['hillshade-exaggeration'] = opacity / 2;
                                }
                            }
                            map_.addLayer(layer, ANCHOR_LAYER_KEY.overlays);
                        }
                    }

                    this._pastOverlays.add(overlay);
                }
            }
        } catch (e) {}
    }

    updateTerrain() {
        const map_ = get(this._map);
        if (!map_) return;

        const mapTerrain = map_.getTerrain();
        const terrain = this.getCurrentTerrain();
        if (JSON.stringify(mapTerrain) !== JSON.stringify(terrain)) {
            if (terrain.exaggeration > 0) {
                map_.setTerrain(terrain);
            } else {
                map_.setTerrain(null);
            }
        }
    }

    async get(
        styleInfo: maplibregl.StyleSpecification | string
    ): Promise<maplibregl.StyleSpecification> {
        if (typeof styleInfo === 'string') {
            let styleUrl = styleInfo as string;
            if (styleUrl.includes(maptilerKeyPlaceHolder)) {
                styleUrl = styleUrl.replace(maptilerKeyPlaceHolder, this._maptilerKey);
            }
            const response = await fetch(styleUrl, { cache: 'force-cache' });
            const style = await response.json();
            return style;
        } else {
            return styleInfo;
        }
    }

    merge(style: maplibregl.StyleSpecification, other: maplibregl.StyleSpecification) {
        style.sources = { ...style.sources, ...other.sources };
        for (let layer of other.layers ?? []) {
            if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
                const textField = layer.layout['text-field'];
                if (
                    Array.isArray(textField) &&
                    textField.length >= 2 &&
                    textField[0] === 'coalesce' &&
                    Array.isArray(textField[1]) &&
                    textField[1][0] === 'get' &&
                    typeof textField[1][1] === 'string' &&
                    textField[1][1].startsWith('name')
                ) {
                    layer.layout['text-field'] = [
                        'coalesce',
                        ['get', `name:${i18n.lang}`],
                        ['get', 'name'],
                    ];
                }
            }
            style.layers.push(layer);
        }
        if (other.sprite && !style.sprite) {
            style.sprite = other.sprite;
        }
        if (other.glyphs && !style.glyphs) {
            style.glyphs = other.glyphs;
        }
    }

    getCurrentTerrain() {
        const terrain = get(terrainSource);
        const source = terrainSources[terrain];
        if (source.url && source.url.includes(maptilerKeyPlaceHolder)) {
            source.url = source.url.replace(maptilerKeyPlaceHolder, this._maptilerKey);
        }
        const map_ = get(this._map);
        return {
            source: terrain,
            exaggeration: !map_ || map_.getPitch() === 0 ? 0 : 1,
        };
    }
}
