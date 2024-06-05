import { map, currentTool, Tool } from "$lib/stores";
import { settings, type GPXFileWithStatistics, dbUtils } from "$lib/db";
import { get, type Readable } from "svelte/store";
import mapboxgl from "mapbox-gl";
import { currentWaypoint, waypointPopup } from "./WaypointPopup";
import { addSelectItem, selectItem, selection } from "$lib/components/file-list/Selection";
import { ListTrackSegmentItem, type ListItem, ListWaypointItem, ListWaypointsItem, ListTrackItem, ListFileItem, ListRootItem } from "$lib/components/file-list/FileList";
import type { Waypoint } from "gpx";
import { produce } from "immer";

let defaultWeight = 5;
let defaultOpacity = 0.6;

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

const { directionMarkers, verticalFileView } = settings;

export class GPXLayer {
    map: mapboxgl.Map;
    fileId: string;
    file: Readable<GPXFileWithStatistics | undefined>;
    layerColor: string;
    markers: mapboxgl.Marker[] = [];
    selected: boolean = false;
    draggable: boolean;
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
            let newSelected = $selection.hasAnyChildren(new ListFileItem(this.fileId));
            if (this.selected || newSelected) {
                this.selected = newSelected;
                this.update();
            }
            if (newSelected) {
                this.moveToFront();
            }
        }));
        this.unsubscribe.push(directionMarkers.subscribe(this.updateBinded));
        this.unsubscribe.push(currentTool.subscribe(tool => {
            if (tool === Tool.WAYPOINT && !this.draggable) {
                this.draggable = true;
                this.markers.forEach(marker => marker.setDraggable(true));
            } else if (tool !== Tool.WAYPOINT && this.draggable) {
                this.draggable = false;
                this.markers.forEach(marker => marker.setDraggable(false));
            }
        }));
        this.draggable = get(currentTool) === Tool.WAYPOINT;

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

        if (get(selection).hasAnyChildren(new ListFileItem(this.fileId))) {
            file.wpt.forEach((waypoint) => { // Update markers
                if (markerIndex < this.markers.length) {
                    this.markers[markerIndex].setLngLat(waypoint.getCoordinates());
                    Object.defineProperty(this.markers[markerIndex], '_waypoint', { value: waypoint, writable: true });
                } else {
                    let marker = new mapboxgl.Marker({
                        draggable: this.draggable
                    }).setLngLat(waypoint.getCoordinates());
                    Object.defineProperty(marker, '_waypoint', { value: waypoint, writable: true });
                    let dragEndTimestamp = 0;
                    marker.getElement().addEventListener('mouseover', (e) => {
                        if (marker._isDragging) {
                            return;
                        }
                        this.showWaypointPopup(marker._waypoint);
                        e.stopPropagation();
                    });
                    marker.getElement().addEventListener('mouseout', () => {
                        this.hideWaypointPopup();
                    });
                    marker.getElement().addEventListener('click', (e) => {
                        if (dragEndTimestamp && Date.now() - dragEndTimestamp < 1000) {
                            return;
                        }

                        if ((e.shiftKey || e.ctrlKey || e.metaKey) && get(selection).hasAnyChildren(new ListWaypointsItem(this.fileId), false)) {
                            addSelectItem(new ListWaypointItem(this.fileId, marker._waypoint._data.index));
                        } else {
                            selectItem(new ListWaypointItem(this.fileId, marker._waypoint._data.index));
                        }
                        if (!get(verticalFileView) && !get(selection).has(new ListFileItem(this.fileId))) {
                            addSelectItem(new ListFileItem(this.fileId));
                        }
                        e.stopPropagation();
                    });
                    marker.on('dragstart', () => {
                        this.map.getCanvas().style.cursor = 'grabbing';
                        marker.getElement().style.cursor = 'grabbing';
                        this.hideWaypointPopup();
                    });
                    marker.on('dragend', (e) => {
                        this.map.getCanvas().style.cursor = '';
                        marker.getElement().style.cursor = '';
                        dbUtils.applyToFile(this.fileId, (file) => {
                            return produce(file, (draft) => {
                                let latLng = marker.getLngLat();
                                draft.wpt[marker._waypoint._data.index].setCoordinates({
                                    lat: latLng.lat,
                                    lon: latLng.lng
                                });
                            });
                        });
                        dragEndTimestamp = Date.now()
                    });
                    this.markers.push(marker);
                }
                markerIndex++;
            });
        }

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
        if (get(currentTool) === Tool.ROUTING && get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints'])) {
            return;
        }

        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let item = undefined;
        if (get(verticalFileView) && file.getSegments().length > 1) { // Select inner item
            let trackIndex = e.features[0].properties.trackIndex;
            let segmentIndex = e.features[0].properties.segmentIndex;
            item = file.children[trackIndex].children.length > 1 ? new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex) : new ListTrackItem(this.fileId, trackIndex);
        } else {
            item = new ListFileItem(this.fileId);
        }

        if (e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
            addSelectItem(item);
        } else {
            selectItem(item);
        }
    }

    showWaypointPopup(waypoint: Waypoint) {
        let marker = this.markers[waypoint._data.index];
        if (marker) {
            currentWaypoint.set(waypoint);
            marker.setPopup(waypointPopup);
            marker.togglePopup();
        }
    }

    hideWaypointPopup() {
        let waypoint = get(currentWaypoint);
        if (waypoint) {
            let marker = this.markers[waypoint._data.index];
            marker?.getPopup()?.remove();
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
            if (get(selection).hasAnyParent(new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)) || get(selection).hasAnyChildren(new ListWaypointsItem(this.fileId), true)) {
                feature.properties.weight = feature.properties.weight + 2;
                feature.properties.opacity = (feature.properties.opacity + 2) / 3;
            }
            feature.properties.trackIndex = trackIndex;
            feature.properties.segmentIndex = segmentIndex;

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
