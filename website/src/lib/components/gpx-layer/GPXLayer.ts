import type { GPXFile } from "gpx";
import { map, selectFiles, currentTool, Tool } from "$lib/stores";
import { get, type Writable } from "svelte/store";
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

export class GPXLayer {
    map: mapboxgl.Map;
    file: Writable<GPXFile>;
    fileId: string;
    layerColor: string;
    popup: mapboxgl.Popup;
    popupElement: HTMLElement;
    markers: mapboxgl.Marker[] = [];
    unsubscribe: () => void;

    addBinded: () => void = this.add.bind(this);
    selectOnClickBinded: (e: any) => void = this.selectOnClick.bind(this);

    constructor(map: mapboxgl.Map, file: Writable<GPXFile>, popup: mapboxgl.Popup, popupElement: HTMLElement) {
        this.map = map;
        this.file = file;
        this.fileId = get(file)._data.id;
        this.layerColor = getColor();
        this.popup = popup;
        this.popupElement = popupElement;
        this.unsubscribe = file.subscribe(this.updateData.bind(this));

        get(this.file)._data.layerColor = this.layerColor;

        this.add();
        this.map.on('style.load', this.addBinded);
    }

    add() {
        if (!this.map.getSource(this.fileId)) {
            let data = this.getGeoJSON();

            this.map.addSource(this.fileId, {
                type: 'geojson',
                data
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
    }

    updateData() {
        let source = this.map.getSource(this.fileId);
        if (source) {
            source.setData(this.getGeoJSON());
        }

        let markerIndex = 0;
        get(this.file).wpt.forEach((waypoint) => { // Update markers
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
        this.map.off('style.load', this.addBinded);

        this.map.removeLayer(this.fileId);
        this.map.removeSource(this.fileId);

        this.markers.forEach((marker) => {
            marker.remove();
        });

        this.unsubscribe();

        decrementColor(this.layerColor);
    }

    moveToFront() {
        this.map.moveLayer(this.fileId);
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
        let data = get(this.file).toGeoJSON();
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
}

function toPointerCursor() {
    get(map).getCanvas().style.cursor = 'pointer';
}

function toDefaultCursor() {
    get(map).getCanvas().style.cursor = '';
}
