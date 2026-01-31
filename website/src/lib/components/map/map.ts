import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MaplibreGeocoder, {
    type MaplibreGeocoderFeatureResults,
} from '@maplibre/maplibre-gl-geocoder';
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css';
import { get, writable, type Writable } from 'svelte/store';
import { settings } from '$lib/logic/settings';
import { tick } from 'svelte';
import { ANCHOR_LAYER_KEY, StyleManager } from '$lib/components/map/style';
import { MapLayerEventManager } from '$lib/components/map/map-layer-event-manager';

const { treeFileView, elevationProfile, bottomPanelSize, rightPanelSize, distanceUnits } = settings;

let fitBoundsOptions: maplibregl.MapOptions['fitBoundsOptions'] = {
    maxZoom: 15,
    linear: true,
    easing: () => 1,
};

export class MapLibreGLMap {
    private _maptilerKey: string = '';
    private _map: maplibregl.Map | null = null;
    private _mapStore: Writable<maplibregl.Map | null> = writable(null);
    private _styleManager: StyleManager | null = null;
    private _onLoadCallbacks: ((map: maplibregl.Map) => void)[] = [];
    private _unsubscribes: (() => void)[] = [];
    private callOnLoadBinded: () => void = this.callOnLoad.bind(this);
    public layerEventManager: MapLayerEventManager | null = null;

    subscribe(run: (value: maplibregl.Map | null) => void, invalidate?: () => void) {
        return this._mapStore.subscribe(run, invalidate);
    }

    init(
        maptilerKey: string,
        language: string,
        hash: boolean,
        geocoder: boolean,
        geolocate: boolean
    ) {
        this._maptilerKey = maptilerKey;
        this._styleManager = new StyleManager(this._mapStore, this._maptilerKey);
        const map = new maplibregl.Map({
            container: 'map',
            style: {
                version: 8,
                projection: {
                    type: 'globe',
                },
                sources: {},
                layers: [],
            },
            zoom: 0,
            hash: hash,
            boxZoom: false,
            maxPitch: 85,
        });
        this.layerEventManager = new MapLayerEventManager(map);
        map.addControl(
            new maplibregl.NavigationControl({
                visualizePitch: true,
            })
        );
        if (geocoder) {
            let geocoder = new MaplibreGeocoder(
                {
                    forwardGeocode: async (config) => {
                        const results: MaplibreGeocoderFeatureResults = {
                            features: [],
                            type: 'FeatureCollection',
                        };
                        try {
                            const request = `https://nominatim.openstreetmap.org/search?format=json&q=${config.query}&limit=5&accept-language=${language}`;
                            const response = await fetch(request);
                            const geojson = await response.json();
                            results.features = geojson.map((result: any) => {
                                return {
                                    type: 'Feature',
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [result.lon, result.lat],
                                    },
                                    place_name: result.display_name,
                                };
                            });
                        } catch (e) {}
                        return results;
                    },
                },
                {
                    maplibregl: maplibregl,
                    enableEventLogging: false,
                    collapsed: true,
                    flyTo: fitBoundsOptions,
                    language,
                }
            );
            map.addControl(geocoder);
        }
        if (geolocate) {
            map.addControl(
                new maplibregl.GeolocateControl({
                    positionOptions: {
                        enableHighAccuracy: true,
                    },
                    fitBoundsOptions,
                    trackUserLocation: true,
                })
            );
        }
        const scaleControl = new maplibregl.ScaleControl({
            unit: get(distanceUnits),
        });
        map.addControl(scaleControl);
        map.on('load', () => {
            this._map = map;
            this._mapStore.set(map); // only set the store after the map has loaded
            window._map = map; // entry point for extensions
            this.resize();
            scaleControl.setUnit(get(distanceUnits));
        });
        map.on('style.load', this.callOnLoadBinded);

        this._unsubscribes.push(treeFileView.subscribe(() => this.resize()));
        this._unsubscribes.push(elevationProfile.subscribe(() => this.resize()));
        this._unsubscribes.push(bottomPanelSize.subscribe(() => this.resize()));
        this._unsubscribes.push(rightPanelSize.subscribe(() => this.resize()));
        this._unsubscribes.push(
            distanceUnits.subscribe((units) => {
                scaleControl.setUnit(units);
            })
        );
    }

    destroy() {
        if (this._map) {
            this._map.remove();
            this._mapStore.set(null);
        }
        this._unsubscribes.forEach((unsubscribe) => unsubscribe());
        this._unsubscribes = [];
    }

    resize() {
        if (this._map) {
            tick().then(() => {
                this._map?.resize();
            });
        }
    }

    toggle3D() {
        if (this._map) {
            if (this._map.getPitch() === 0) {
                this._map.easeTo({ pitch: 70 });
            } else {
                this._map.easeTo({ pitch: 0 });
            }
        }
    }

    onLoad(callback: (map: maplibregl.Map) => void) {
        if (this._map) {
            callback(this._map);
        } else {
            this._onLoadCallbacks.push(callback);
        }
    }

    callOnLoad() {
        if (this._map && this._map.getLayer(ANCHOR_LAYER_KEY.overlays)) {
            this._onLoadCallbacks.forEach((callback) => callback(this._map!));
            this._onLoadCallbacks = [];
            this._map.off('style.load', this.callOnLoadBinded);
        }
    }
}

export const map = new MapLibreGLMap();
