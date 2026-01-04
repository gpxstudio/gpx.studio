import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { get, writable, type Writable } from 'svelte/store';
import { settings } from '$lib/logic/settings';
import { tick } from 'svelte';

const { treeFileView, elevationProfile, bottomPanelSize, rightPanelSize, distanceUnits } = settings;

let fitBoundsOptions: mapboxgl.MapOptions['fitBoundsOptions'] = {
    maxZoom: 15,
    linear: true,
    easing: () => 1,
};

export class MapboxGLMap {
    private _map: Writable<mapboxgl.Map | null> = writable(null);
    private _onLoadCallbacks: ((map: mapboxgl.Map) => void)[] = [];
    private _unsubscribes: (() => void)[] = [];

    subscribe(run: (value: mapboxgl.Map | null) => void, invalidate?: () => void) {
        return this._map.subscribe(run, invalidate);
    }

    init(
        accessToken: string,
        language: string,
        hash: boolean,
        geocoder: boolean,
        geolocate: boolean
    ) {
        const map = new mapboxgl.Map({
            container: 'map',
            style: {
                version: 8,
                sources: {},
                layers: [],
                imports: [
                    {
                        id: 'basemap',
                        url: '',
                    },
                    {
                        id: 'overlays',
                        url: '',
                        data: {
                            version: 8,
                            sources: {},
                            layers: [],
                        },
                    },
                ],
            },
            projection: 'globe',
            zoom: 0,
            hash: hash,
            language,
            attributionControl: false,
            logoPosition: 'bottom-right',
            boxZoom: false,
        });
        map.addControl(
            new mapboxgl.AttributionControl({
                compact: true,
            })
        );
        map.addControl(
            new mapboxgl.NavigationControl({
                visualizePitch: true,
            })
        );
        if (geocoder) {
            let geocoder = new MapboxGeocoder({
                mapboxgl: mapboxgl,
                enableEventLogging: false,
                collapsed: true,
                flyTo: fitBoundsOptions,
                language,
                localGeocoder: () => [],
                localGeocoderOnly: true,
                externalGeocoder: (query: string) =>
                    fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&accept-language=${language}`
                    )
                        .then((response) => response.json())
                        .then((data) => {
                            return data.map((result: any) => {
                                return {
                                    type: 'Feature',
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [result.lon, result.lat],
                                    },
                                    place_name: result.display_name,
                                };
                            });
                        }),
            });
            let onKeyDown = geocoder._onKeyDown;
            geocoder._onKeyDown = (e: KeyboardEvent) => {
                // Trigger search on Enter key only
                if (e.key === 'Enter') {
                    onKeyDown.apply(geocoder, [{ target: geocoder._inputEl }]);
                } else if (geocoder._typeahead.data.length > 0) {
                    geocoder._typeahead.clear();
                }
            };
            map.addControl(geocoder);
        }
        if (geolocate) {
            map.addControl(
                new mapboxgl.GeolocateControl({
                    positionOptions: {
                        enableHighAccuracy: true,
                    },
                    fitBoundsOptions,
                    trackUserLocation: true,
                    showUserHeading: true,
                })
            );
        }
        const scaleControl = new mapboxgl.ScaleControl({
            unit: get(distanceUnits),
        });
        map.addControl(scaleControl);
        map.on('style.load', () => {
            map.addSource('mapbox-dem', {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14,
            });
            if (map.getPitch() > 0) {
                map.setTerrain({
                    source: 'mapbox-dem',
                    exaggeration: 1,
                });
            }
            map.setFog({
                color: 'rgb(186, 210, 235)',
                'high-color': 'rgb(36, 92, 223)',
                'horizon-blend': 0.1,
                'space-color': 'rgb(156, 240, 255)',
            });
            map.on('pitch', () => {
                if (map.getPitch() > 0) {
                    map.setTerrain({
                        source: 'mapbox-dem',
                        exaggeration: 1,
                    });
                } else {
                    map.setTerrain(null);
                }
            });
        });
        map.on('style.import.load', () => {
            const basemap = map.getStyle().imports?.find((imprt) => imprt.id === 'basemap');
            if (basemap && basemap.data && basemap.data.glyphs) {
                map.setGlyphsUrl(basemap.data.glyphs);
            }
        });
        map.on('load', () => {
            this._map.set(map); // only set the store after the map has loaded
            window._map = map; // entry point for extensions
            this.resize();
            scaleControl.setUnit(get(distanceUnits));

            this._onLoadCallbacks.forEach((callback) => callback(map));
            this._onLoadCallbacks = [];
        });

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

    onLoad(callback: (map: mapboxgl.Map) => void) {
        const map = get(this._map);
        if (map) {
            callback(map);
        } else {
            this._onLoadCallbacks.push(callback);
        }
    }

    destroy() {
        const map = get(this._map);
        if (map) {
            map.remove();
            this._map.set(null);
        }
        this._unsubscribes.forEach((unsubscribe) => unsubscribe());
        this._unsubscribes = [];
    }

    resize() {
        const map = get(this._map);
        if (map) {
            tick().then(() => {
                map.resize();
            });
        }
    }

    toggle3D() {
        const map = get(this._map);
        if (map) {
            if (map.getPitch() === 0) {
                map.easeTo({ pitch: 70 });
            } else {
                map.easeTo({ pitch: 0 });
            }
        }
    }
}

export const map = new MapboxGLMap();
