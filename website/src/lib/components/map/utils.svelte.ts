import { TrackPoint, Waypoint, type Coordinates } from 'gpx';
import mapboxgl from 'mapbox-gl';
import { tick, mount } from 'svelte';
// import MapPopupComponent from '$lib/components/map/MapPopup.svelte';
import { get } from 'svelte/store';
// import { fileObservers } from '$lib/db';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

let fitBoundsOptions: mapboxgl.MapOptions['fitBoundsOptions'] = {
    maxZoom: 15,
    linear: true,
    easing: () => 1,
};

export class MapboxGLMap {
    private _map: mapboxgl.Map | null = $state(null);
    private _onLoadCallbacks: ((map: mapboxgl.Map) => void)[] = [];

    init(
        accessToken: string,
        language: string,
        distanceUnits: 'metric' | 'imperial' | 'nautical',
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
                        id: 'glyphs-and-sprite', // make Mapbox glyphs and sprite available to other styles
                        url: '',
                        data: {
                            version: 8,
                            sources: {},
                            layers: [],
                            glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
                            sprite: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/sprite?access_token=${accessToken}`,
                        },
                    },
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
            unit: distanceUnits,
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
        map.on('load', () => {
            this._map = map; // only set the store after the map has loaded
            window._map = map; // entry point for extensions
            scaleControl.setUnit(distanceUnits);

            this._onLoadCallbacks.forEach((callback) => callback(map));
            this._onLoadCallbacks = [];
        });
    }

    onLoad(callback: (map: mapboxgl.Map) => void) {
        if (this._map) {
            callback(this._map);
        } else {
            this._onLoadCallbacks.push(callback);
        }
    }

    destroy() {
        if (this._map) {
            this._map.remove();
            this._map = null;
        }
    }

    get value(): mapboxgl.Map | null {
        return this._map;
    }

    resize() {
        if (this._map) {
            this._map.resize();
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
}

export const map = new MapboxGLMap();

const targetMapBounds: {
    bounds: mapboxgl.LngLatBounds;
    ids: string[];
    total: number;
} = $state({
    bounds: new mapboxgl.LngLatBounds([180, 90, -180, -90]),
    ids: [],
    total: 0,
});

// $effect(() => {
//     if (
//         map.current === null ||
//         targetMapBounds.ids.length > 0 ||
//         (targetMapBounds.bounds.getSouth() === 90 &&
//             targetMapBounds.bounds.getWest() === 180 &&
//             targetMapBounds.bounds.getNorth() === -90 &&
//             targetMapBounds.bounds.getEast() === -180)
//     ) {
//         return;
//     }

//     let currentZoom = map.current.getZoom();
//     let currentBounds = map.current.getBounds();
//     if (
//         targetMapBounds.total !== get(fileObservers).size &&
//         currentBounds &&
//         currentZoom > 2 // Extend current bounds only if the map is zoomed in
//     ) {
//         // There are other files on the map
//         if (
//             currentBounds.contains(targetMapBounds.bounds.getSouthEast()) &&
//             currentBounds.contains(targetMapBounds.bounds.getNorthWest())
//         ) {
//             return;
//         }

//         targetMapBounds.bounds.extend(currentBounds.getSouthWest());
//         targetMapBounds.bounds.extend(currentBounds.getNorthEast());
//     }

//     map.current.fitBounds(targetMapBounds.bounds, { padding: 80, linear: true, easing: () => 1 });
// });

export function initTargetMapBounds(ids: string[]) {
    targetMapBounds.bounds = new mapboxgl.LngLatBounds([180, 90, -180, -90]);
    targetMapBounds.ids = ids;
    targetMapBounds.total = ids.length;
}

export function updateTargetMapBounds(
    id: string,
    bounds: { southWest: Coordinates; northEast: Coordinates }
) {
    if (targetMapBounds.ids.indexOf(id) === -1) {
        return;
    }

    if (
        bounds.southWest.lat !== 90 ||
        bounds.southWest.lon !== 180 ||
        bounds.northEast.lat !== -90 ||
        bounds.northEast.lon !== -180
    ) {
        // Avoid update for empty (new) files
        targetMapBounds.ids = targetMapBounds.ids.filter((x) => x !== id);
        targetMapBounds.bounds.extend(bounds.southWest);
        targetMapBounds.bounds.extend(bounds.northEast);
    }
}

// export function centerMapOnSelection() {
//     let selected = get(selection).getSelected();
//     let bounds = new mapboxgl.LngLatBounds();

//     if (selected.find((item) => item instanceof ListWaypointItem)) {
//         applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
//             let file = getFile(fileId);
//             if (file) {
//                 items.forEach((item) => {
//                     if (item instanceof ListWaypointItem) {
//                         let waypoint = file.wpt[item.getWaypointIndex()];
//                         if (waypoint) {
//                             bounds.extend([waypoint.getLongitude(), waypoint.getLatitude()]);
//                         }
//                     }
//                 });
//             }
//         });
//     } else {
//         let selectionBounds = get(gpxStatistics).global.bounds;
//         bounds.setNorthEast(selectionBounds.northEast);
//         bounds.setSouthWest(selectionBounds.southWest);
//     }

//     get(map)?.fitBounds(bounds, {
//         padding: 80,
//         easing: () => 1,
//         maxZoom: 15,
//     });
// }

export type PopupItem<T = Waypoint | TrackPoint | any> = {
    item: T;
    fileId?: string;
    hide?: () => void;
};

// export class MapPopup {
//     map: mapboxgl.Map;
//     popup: mapboxgl.Popup;
//     item: PopupItem | null = $state(null);
//     maybeHideBinded = this.maybeHide.bind(this);

//     constructor(map: mapboxgl.Map, options?: mapboxgl.PopupOptions) {
//         this.map = map;
//         this.popup = new mapboxgl.Popup(options);

//         let component = mount(MapPopupComponent, {
//             target: document.body,
//             props: {
//                 item: this.item,
//             },
//         });

//         tick().then(() => this.popup.setDOMContent(component.container));
//     }

//     setItem(item: PopupItem | null) {
//         if (item) item.hide = () => this.hide();
//         this.item = item;
//         if (item === null) {
//             this.hide();
//         } else {
//             tick().then(() => this.show());
//         }
//     }

//     show() {
//         if (this.item === null) {
//             this.hide();
//             return;
//         }
//         this.popup.setLngLat(this.getCoordinates()).addTo(this.map);
//         this.map.on('mousemove', this.maybeHideBinded);
//     }

//     maybeHide(e: mapboxgl.MapMouseEvent) {
//         if (this.item === null) {
//             this.hide();
//             return;
//         }
//         if (this.map.project(this.getCoordinates()).dist(this.map.project(e.lngLat)) > 60) {
//             this.hide();
//         }
//     }

//     hide() {
//         this.popup.remove();
//         this.map.off('mousemove', this.maybeHideBinded);
//     }

//     remove() {
//         this.popup.remove();
//     }

//     getCoordinates() {
//         if (this.item === null) {
//             return new mapboxgl.LngLat(0, 0);
//         }
//         return this.item.item instanceof Waypoint || this.item.item instanceof TrackPoint
//             ? this.item.item.getCoordinates()
//             : new mapboxgl.LngLat(this.item.item.lon, this.item.item.lat);
//     }
// }
