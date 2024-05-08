import { map, selectFiles, currentTool, Tool } from "$lib/stores";
import { settings, type GPXFileWithStatistics } from "$lib/db";
import { get, type Readable } from "svelte/store";
import mapboxgl from "mapbox-gl";

let defaultWeight = 6;
let defaultOpacity = 1;

const colors = [
    '#ff0000',
    '#0000ff',
    '#46e646',
    '#00ccff',
    '#ff9900',
    '#ff00ff',
    '#ffff32',
    '#288228',
    '#9933ff',
    '#50f0be',
    '#8c645a'
];

const colorCount: { [key: string]: number } = {};
for (let color of colors) {
    colorCount[color] = 0;
}

// Get the color with the least amount of uses
function getColor() {
    let color = colors.reduce((a, b) => (colorCount[a] <= colorCount[b] ? a : b));
    colorCount[color]++;
    return color;
}

function decrementColor(color: string) {
    colorCount[color]--;
}

const { directionMarkers, distanceMarkers, distanceUnits } = settings;

export class GPXLayer {
    map: mapboxgl.Map;
    fileId: string;
    file: Readable<GPXFileWithStatistics | undefined>;
    layerColor: string;
    popup: mapboxgl.Popup;
    popupElement: HTMLElement;
    markers: mapboxgl.Marker[] = [];
    unsubscribe: Function[] = [];

    updateBinded: () => void = this.update.bind(this);
    selectOnClickBinded: (e: any) => void = this.selectOnClick.bind(this);

    constructor(map: mapboxgl.Map, fileId: string, file: Readable<GPXFileWithStatistics | undefined>, popup: mapboxgl.Popup, popupElement: HTMLElement) {
        this.map = map;
        this.fileId = fileId;
        this.file = file;
        this.layerColor = getColor();
        this.popup = popup;
        this.popupElement = popupElement;
        this.unsubscribe.push(file.subscribe(this.updateBinded));
        this.unsubscribe.push(directionMarkers.subscribe(this.updateBinded));
        this.unsubscribe.push(distanceMarkers.subscribe(this.updateBinded));
        this.unsubscribe.push(distanceUnits.subscribe(() => {
            if (get(distanceMarkers)) {
                this.update();
            }
        }));

        this.map.on('style.load', this.updateBinded);
    }

    update() {
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        try {

            let source = this.map.getSource(this.fileId);
            if (source) {
                source.setData(this.getGeoJSON());
            } else {
                this.map.addSource(this.fileId, {
                    type: 'geojson',
                    data: this.getGeoJSON()
                });
            }

            if (!this.map.getLayer(this.fileId)) {
                this.map.addLayer({
                    id: this.fileId,
                    type: 'line',
                    source: this.fileId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': ['get', 'weight'],
                        'line-opacity': ['get', 'opacity']
                    }
                });

                this.map.on('click', this.fileId, this.selectOnClickBinded);
                this.map.on('mouseenter', this.fileId, toPointerCursor);
                this.map.on('mouseleave', this.fileId, toDefaultCursor);
            }

            if (get(directionMarkers)) {
                if (!this.map.getLayer(this.fileId + '-direction')) {
                    this.map.addLayer({
                        id: this.fileId + '-direction',
                        type: 'symbol',
                        source: this.fileId,
                        layout: {
                            'text-field': '>',
                            'text-keep-upright': false,
                            'text-max-angle': 361,
                            'text-allow-overlap': true,
                            'symbol-placement': 'line',
                            'symbol-spacing': 25,
                        },
                        paint: {
                            'text-color': 'white',
                            'text-halo-width': 0.5,
                            'text-halo-color': 'white'
                        }
                    });
                }
            } else {
                if (this.map.getLayer(this.fileId + '-direction')) {
                    this.map.removeLayer(this.fileId + '-direction');
                }
            }

            if (get(distanceMarkers)) {
                let distanceSource = this.map.getSource(this.fileId + '-distance');
                if (distanceSource) {
                    distanceSource.setData(this.getDistanceMarkersGeoJSON());
                } else {
                    this.map.addSource(this.fileId + '-distance', {
                        type: 'geojson',
                        data: this.getDistanceMarkersGeoJSON()
                    });
                }
                if (!this.map.getLayer(this.fileId + '-distance')) {
                    this.map.addLayer({
                        id: this.fileId + '-distance',
                        type: 'symbol',
                        source: this.fileId + '-distance',
                        layout: {
                            'text-field': ['get', 'distance'],
                            'text-size': 12,
                            'text-font': ['Open Sans Regular'],
                            'icon-image': ['get', 'icon'],
                            'icon-padding': 50,
                            'icon-allow-overlap': true,
                        },
                        paint: {
                            'text-halo-width': 0.1,
                            'text-halo-color': 'black'
                        }
                    });
                } else {
                    this.map.moveLayer(this.fileId + '-distance');
                }
            } else {
                if (this.map.getLayer(this.fileId + '-distance')) {
                    this.map.removeLayer(this.fileId + '-distance');
                }
            }
        } catch (e) { // No reliable way to check if the map is ready to add sources and layers
            return;
        }

        let markerIndex = 0;
        file.wpt.forEach((waypoint) => { // Update markers
            if (markerIndex < this.markers.length) {
                this.markers[markerIndex].setLngLat(waypoint.getCoordinates());
            } else {
                let marker = new mapboxgl.Marker().setLngLat(waypoint.getCoordinates());
                marker.getElement().addEventListener('click', (e) => {
                    marker.setPopup(this.popup);
                    marker.togglePopup();
                    e.stopPropagation();
                });

                this.markers.push(marker);
            }
            markerIndex++;
        });

        while (markerIndex < this.markers.length) { // Remove extra markers
            this.markers.pop()?.remove();
        }

        this.markers.forEach((marker) => {
            marker.addTo(this.map);
        });
    }

    remove() {
        this.map.off('click', this.fileId, this.selectOnClickBinded);
        this.map.off('mouseenter', this.fileId, toPointerCursor);
        this.map.off('mouseleave', this.fileId, toDefaultCursor);
        this.map.off('style.load', this.updateBinded);

        if (this.map.getLayer(this.fileId + '-direction')) {
            this.map.removeLayer(this.fileId + '-direction');
        }
        if (this.map.getLayer(this.fileId + '-distance')) {
            this.map.removeLayer(this.fileId + '-distance');
        }
        if (this.map.getLayer(this.fileId)) {
            this.map.removeLayer(this.fileId);
        }
        if (this.map.getSource(this.fileId)) {
            this.map.removeSource(this.fileId);
        }

        this.markers.forEach((marker) => {
            marker.remove();
        });

        this.unsubscribe.forEach((unsubscribe) => unsubscribe());

        decrementColor(this.layerColor);
    }

    moveToFront() {
        if (this.map.getLayer(this.fileId)) {
            this.map.moveLayer(this.fileId);
        }
        if (this.map.getLayer(this.fileId + '-direction')) {
            this.map.moveLayer(this.fileId + '-direction');
        }
        if (this.map.getLayer(this.fileId + '-distance')) {
            this.map.moveLayer(this.fileId + '-distance');
        }
    }

    selectOnClick(e: any) {
        if (get(currentTool) === Tool.ROUTING) {
            return;
        }
        if (e.originalEvent.shiftKey) {
            get(selectFiles).addSelect(this.fileId);
        } else {
            get(selectFiles).select(this.fileId);
        }
    }

    getGeoJSON(): GeoJSON.FeatureCollection {
        let file = get(this.file)?.file;
        if (!file) {
            return {
                type: 'FeatureCollection',
                features: []
            };
        }

        let data = file.toGeoJSON();
        for (let feature of data.features) {
            if (!feature.properties) {
                feature.properties = {};
            }
            if (!feature.properties.color) {
                feature.properties.color = this.layerColor;
            }
            if (!feature.properties.weight) {
                feature.properties.weight = defaultWeight;
            }
            if (!feature.properties.opacity) {
                feature.properties.opacity = defaultOpacity;
            }
        }
        return data;
    }

    getDistanceMarkersGeoJSON(): GeoJSON.FeatureCollection {
        let statistics = get(this.file)?.statistics;
        if (!statistics) {
            return {
                type: 'FeatureCollection',
                features: []
            };
        }

        let features = [];
        let currentTargetDistance = 1;
        for (let i = 0; i < statistics.local.distance.length; i++) {
            if (statistics.local.distance[i] >= currentTargetDistance * (get(distanceUnits) === 'metric' ? 1 : 1.60934)) {
                let distance = currentTargetDistance.toFixed(0);
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [statistics.local.points[i].getLongitude(), statistics.local.points[i].getLatitude()]
                    },
                    properties: {
                        distance,
                        icon: distance.length < 3 ? 'circle-white-2' : 'circle-white-3'
                    }
                } as GeoJSON.Feature);
                currentTargetDistance += 1;
            }
        }

        return {
            type: 'FeatureCollection',
            features
        };
    }
}

function toPointerCursor() {
    get(map).getCanvas().style.cursor = 'pointer';
}

function toDefaultCursor() {
    get(map).getCanvas().style.cursor = '';
}
