import { map, currentTool, Tool } from "$lib/stores";
import { settings, type GPXFileWithStatistics } from "$lib/db";
import { get, type Readable } from "svelte/store";
import mapboxgl from "mapbox-gl";
import { currentWaypoint, waypointPopup } from "./WaypointPopup";
import { addSelect, selectFile, selection } from "$lib/components/file-list/Selection";
import { ListTrackSegmentItem, type ListItem, ListFileItem, ListTrackItem } from "$lib/components/file-list/FileList";

let defaultWeight = 5;
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

const { directionMarkers } = settings;

export class GPXLayer {
    map: mapboxgl.Map;
    fileId: string;
    file: Readable<GPXFileWithStatistics | undefined>;
    layerColor: string;
    markers: mapboxgl.Marker[] = [];
    selected: ListItem[] = [];
    unsubscribe: Function[] = [];

    updateBinded: () => void = this.update.bind(this);
    selectOnClickBinded: (e: any) => void = this.selectOnClick.bind(this);

    constructor(map: mapboxgl.Map, fileId: string, file: Readable<GPXFileWithStatistics | undefined>) {
        this.map = map;
        this.fileId = fileId;
        this.file = file;
        this.layerColor = getColor();
        this.unsubscribe.push(file.subscribe(this.updateBinded));
        this.unsubscribe.push(selection.subscribe($selection => {
            let selected = $selection.getChild(fileId)?.getSelected() || [];
            if (selected.length !== this.selected.length || selected.some((item, index) => item !== this.selected[index])) {
                this.selected = selected;
                this.update();
                if (this.selected.length > 0) {
                    this.moveToFront();
                }
            }
        }));
        this.unsubscribe.push(directionMarkers.subscribe(this.updateBinded));

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
        } catch (e) { // No reliable way to check if the map is ready to add sources and layers
            return;
        }

        let markerIndex = 0;
        file.wpt.forEach((waypoint) => { // Update markers
            if (markerIndex < this.markers.length) {
                this.markers[markerIndex].setLngLat(waypoint.getCoordinates());
            } else {
                let marker = new mapboxgl.Marker().setLngLat(waypoint.getCoordinates());
                marker.getElement().addEventListener('mouseover', (e) => {
                    currentWaypoint.set(waypoint);
                    marker.setPopup(waypointPopup);
                    marker.togglePopup();
                    e.stopPropagation();
                });
                marker.getElement().addEventListener('mouseout', () => {
                    marker.togglePopup();
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
    }

    selectOnClick(e: any) {
        if (get(currentTool) === Tool.ROUTING) {
            return;
        }
        if (e.originalEvent.shiftKey) {
            addSelect(this.fileId);
        } else {
            selectFile(this.fileId);
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

        let trackIndex = 0, segmentIndex = 0;
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
            if (get(selection).has(new ListFileItem(this.fileId)) || get(selection).has(new ListTrackItem(this.fileId, trackIndex)) || get(selection).has(new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex))) {
                feature.properties.weight = feature.properties.weight + 2;
            }

            segmentIndex++;
            if (segmentIndex >= file.trk[trackIndex].trkseg.length) {
                segmentIndex = 0;
                trackIndex++;
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
