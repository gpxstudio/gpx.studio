import { currentTool, map, Tool } from "$lib/stores";
import { settings, type GPXFileWithStatistics, dbUtils } from "$lib/db";
import { get, type Readable } from "svelte/store";
import mapboxgl from "mapbox-gl";
import { waypointPopup, deleteWaypoint, trackpointPopup } from "./GPXLayerPopup";
import { addSelectItem, selectItem, selection } from "$lib/components/file-list/Selection";
import { ListTrackSegmentItem, ListWaypointItem, ListWaypointsItem, ListTrackItem, ListFileItem, ListRootItem } from "$lib/components/file-list/FileList";
import { getClosestLinePoint, getElevation, resetCursor, setGrabbingCursor, setPointerCursor, setScissorsCursor } from "$lib/utils";
import { selectedWaypoint } from "$lib/components/toolbar/tools/Waypoint.svelte";
import { MapPin, Square } from "lucide-static";
import { getSymbolKey, symbols } from "$lib/assets/symbols";

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
    if (colorCount.hasOwnProperty(color)) {
        colorCount[color]--;
    }
}

const inspectKey = 'Shift';
let inspectKeyDown: KeyDown | null = null;
class KeyDown {
    key: string;
    down: boolean = false;
    constructor(key: string) {
        this.key = key;
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }
    onKeyDown = (e: KeyboardEvent) => {
        if (e.key === this.key) {
            this.down = true;
        }
    }
    onKeyUp = (e: KeyboardEvent) => {
        if (e.key === this.key) {
            this.down = false;
        }
    }
    isDown() {
        return this.down;
    }
}

function getMarkerForSymbol(symbol: string | undefined, layerColor: string) {
    let symbolSvg = symbol ? symbols[symbol]?.iconSvg : undefined;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    ${Square
            .replace('width="24"', 'width="12"')
            .replace('height="24"', 'height="12"')
            .replace('stroke="currentColor"', 'stroke="SteelBlue"')
            .replace('stroke-width="2"', 'stroke-width="1.5" x="9.6" y="0.4"')
            .replace('fill="none"', `fill="${layerColor}"`)}
    ${MapPin
            .replace('width="24"', '')
            .replace('height="24"', '')
            .replace('stroke="currentColor"', '')
            .replace('path', `path fill="#3fb1ce" stroke="SteelBlue" stroke-width="1"`)
            .replace('circle', `circle fill="${symbolSvg ? 'none' : 'white'}" stroke="${symbolSvg ? 'none' : 'white'}" stroke-width="2"`)} 
    ${symbolSvg?.replace('width="24"', 'width="10"')
            .replace('height="24"', 'height="10"')
            .replace('stroke="currentColor"', 'stroke="white"')
            .replace('stroke-width="2"', 'stroke-width="2.5" x="7" y="5"') ?? ''}
    </svg>`;
}

const { directionMarkers, treeFileView, defaultOpacity, defaultWidth } = settings;

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
    layerOnMouseEnterBinded: (e: any) => void = this.layerOnMouseEnter.bind(this);
    layerOnMouseLeaveBinded: () => void = this.layerOnMouseLeave.bind(this);
    layerOnMouseMoveBinded: (e: any) => void = this.layerOnMouseMove.bind(this);
    layerOnClickBinded: (e: any) => void = this.layerOnClick.bind(this);
    layerOnContextMenuBinded: (e: any) => void = this.layerOnContextMenu.bind(this);

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

        this.map.on('style.import.load', this.updateBinded);

        if (inspectKeyDown === null) {
            inspectKeyDown = new KeyDown(inspectKey);
        }
    }

    update() {
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        if (file._data.style && file._data.style.color && this.layerColor !== `#${file._data.style.color}`) {
            decrementColor(this.layerColor);
            this.layerColor = `#${file._data.style.color}`;
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
                        'line-width': ['get', 'width'],
                        'line-opacity': ['get', 'opacity']
                    }
                });

                this.map.on('click', this.fileId, this.layerOnClickBinded);
                this.map.on('contextmenu', this.fileId, this.layerOnContextMenuBinded);
                this.map.on('mouseenter', this.fileId, this.layerOnMouseEnterBinded);
                this.map.on('mouseleave', this.fileId, this.layerOnMouseLeaveBinded);
                this.map.on('mousemove', this.fileId, this.layerOnMouseMoveBinded);
            }

            if (get(directionMarkers)) {
                if (!this.map.getLayer(this.fileId + '-direction')) {
                    this.map.addLayer({
                        id: this.fileId + '-direction',
                        type: 'symbol',
                        source: this.fileId,
                        layout: {
                            'text-field': '»',
                            'text-offset': [0, -0.1],
                            'text-keep-upright': false,
                            'text-max-angle': 361,
                            'text-allow-overlap': true,
                            'text-font': ['Open Sans Bold'],
                            'symbol-placement': 'line',
                            'symbol-spacing': 20,
                        },
                        paint: {
                            'text-color': 'white',
                            'text-opacity': 0.7,
                            'text-halo-width': 0.2,
                            'text-halo-color': 'white'
                        }
                    }, this.map.getLayer('distance-markers') ? 'distance-markers' : undefined);
                }
            } else {
                if (this.map.getLayer(this.fileId + '-direction')) {
                    this.map.removeLayer(this.fileId + '-direction');
                }
            }

            let visibleItems: [number, number][] = [];
            file.forEachSegment((segment, trackIndex, segmentIndex) => {
                if (!segment._data.hidden) {
                    visibleItems.push([trackIndex, segmentIndex]);
                }
            });

            this.map.setFilter(this.fileId, ['any', ...visibleItems.map(([trackIndex, segmentIndex]) => ['all', ['==', 'trackIndex', trackIndex], ['==', 'segmentIndex', segmentIndex]])], { validate: false });
            if (this.map.getLayer(this.fileId + '-direction')) {
                this.map.setFilter(this.fileId + '-direction', ['any', ...visibleItems.map(([trackIndex, segmentIndex]) => ['all', ['==', 'trackIndex', trackIndex], ['==', 'segmentIndex', segmentIndex]])], { validate: false });
            }
        } catch (e) { // No reliable way to check if the map is ready to add sources and layers
            return;
        }

        let markerIndex = 0;

        if (get(selection).hasAnyChildren(new ListFileItem(this.fileId))) {
            file.wpt.forEach((waypoint) => { // Update markers
                let symbolKey = getSymbolKey(waypoint.sym);
                if (markerIndex < this.markers.length) {
                    this.markers[markerIndex].getElement().innerHTML = getMarkerForSymbol(symbolKey, this.layerColor);
                    this.markers[markerIndex].setLngLat(waypoint.getCoordinates());
                    Object.defineProperty(this.markers[markerIndex], '_waypoint', { value: waypoint, writable: true });
                } else {
                    let element = document.createElement('div');
                    element.classList.add('w-8', 'h-8', 'drop-shadow-xl');
                    element.innerHTML = getMarkerForSymbol(symbolKey, this.layerColor);
                    let marker = new mapboxgl.Marker({
                        draggable: this.draggable,
                        element,
                        anchor: 'bottom'
                    }).setLngLat(waypoint.getCoordinates());
                    Object.defineProperty(marker, '_waypoint', { value: waypoint, writable: true });
                    let dragEndTimestamp = 0;
                    marker.getElement().addEventListener('mousemove', (e) => {
                        if (marker._isDragging) {
                            return;
                        }
                        waypointPopup?.setItem({ item: marker._waypoint, fileId: this.fileId });
                        e.stopPropagation();
                    });
                    marker.getElement().addEventListener('click', (e) => {
                        if (dragEndTimestamp && Date.now() - dragEndTimestamp < 1000) {
                            return;
                        }

                        if (get(currentTool) === Tool.WAYPOINT && e.shiftKey) {
                            deleteWaypoint(this.fileId, marker._waypoint._data.index);
                            e.stopPropagation();
                            return;
                        }

                        if (get(treeFileView)) {
                            if ((e.ctrlKey || e.metaKey) && get(selection).hasAnyChildren(new ListWaypointsItem(this.fileId), false)) {
                                addSelectItem(new ListWaypointItem(this.fileId, marker._waypoint._data.index));
                            } else {
                                selectItem(new ListWaypointItem(this.fileId, marker._waypoint._data.index));
                            }
                        } else if (get(currentTool) === Tool.WAYPOINT) {
                            selectedWaypoint.set([marker._waypoint, this.fileId]);
                        } else {
                            waypointPopup?.setItem({ item: marker._waypoint, fileId: this.fileId });
                        }
                        e.stopPropagation();
                    });
                    marker.on('dragstart', () => {
                        setGrabbingCursor();
                        marker.getElement().style.cursor = 'grabbing';
                        waypointPopup?.hide();
                    });
                    marker.on('dragend', (e) => {
                        resetCursor();
                        marker.getElement().style.cursor = '';
                        getElevation([marker._waypoint]).then((ele) => {
                            dbUtils.applyToFile(this.fileId, (file) => {
                                let latLng = marker.getLngLat();
                                let wpt = file.wpt[marker._waypoint._data.index];
                                wpt.setCoordinates({
                                    lat: latLng.lat,
                                    lon: latLng.lng
                                });
                                wpt.ele = ele[0];
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
            if (!marker._waypoint._data.hidden) {
                marker.addTo(this.map);
            } else {
                marker.remove();
            }
        });
    }

    updateMap(map: mapboxgl.Map) {
        this.map = map;
        this.map.on('style.import.load', this.updateBinded);
        this.update();
    }

    remove() {
        if (get(map)) {
            this.map.off('click', this.fileId, this.layerOnClickBinded);
            this.map.off('contextmenu', this.fileId, this.layerOnContextMenuBinded);
            this.map.off('mouseenter', this.fileId, this.layerOnMouseEnterBinded);
            this.map.off('mouseleave', this.fileId, this.layerOnMouseLeaveBinded);
            this.map.off('mousemove', this.fileId, this.layerOnMouseMoveBinded);
            this.map.off('style.import.load', this.updateBinded);

            if (this.map.getLayer(this.fileId + '-direction')) {
                this.map.removeLayer(this.fileId + '-direction');
            }
            if (this.map.getLayer(this.fileId)) {
                this.map.removeLayer(this.fileId);
            }
            if (this.map.getSource(this.fileId)) {
                this.map.removeSource(this.fileId);
            }
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
            this.map.moveLayer(this.fileId + '-direction', this.map.getLayer('distance-markers') ? 'distance-markers' : undefined);
        }
    }

    layerOnMouseEnter(e: any) {
        let trackIndex = e.features[0].properties.trackIndex;
        let segmentIndex = e.features[0].properties.segmentIndex;

        if (get(currentTool) === Tool.SCISSORS && get(selection).hasAnyParent(new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex))) {
            setScissorsCursor();
        } else {
            setPointerCursor();
        }
    }

    layerOnMouseLeave() {
        resetCursor();
    }

    layerOnMouseMove(e: any) {
        if (inspectKeyDown?.isDown()) {
            let trackIndex = e.features[0].properties.trackIndex;
            let segmentIndex = e.features[0].properties.segmentIndex;

            const file = get(this.file)?.file;
            if (file) {
                const closest = getClosestLinePoint(file.trk[trackIndex].trkseg[segmentIndex].trkpt, { lat: e.lngLat.lat, lon: e.lngLat.lng });
                trackpointPopup?.setItem({ item: closest, fileId: this.fileId });
            }
        }
    }

    layerOnClick(e: any) {
        if (get(currentTool) === Tool.ROUTING && get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints'])) {
            return;
        }

        let trackIndex = e.features[0].properties.trackIndex;
        let segmentIndex = e.features[0].properties.segmentIndex;

        if (get(currentTool) === Tool.SCISSORS && get(selection).hasAnyParent(new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex))) {
            dbUtils.split(this.fileId, trackIndex, segmentIndex, { lat: e.lngLat.lat, lon: e.lngLat.lng });
            return;
        }

        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let item = undefined;
        if (get(treeFileView) && file.getSegments().length > 1) { // Select inner item
            item = file.children[trackIndex].children.length > 1 ? new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex) : new ListTrackItem(this.fileId, trackIndex);
        } else {
            item = new ListFileItem(this.fileId);
        }

        if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
            addSelectItem(item);
        } else {
            selectItem(item);
        }
    }

    layerOnContextMenu(e: any) {
        if (e.originalEvent.ctrlKey) {
            this.layerOnClick(e);
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
            if (!feature.properties.opacity) {
                feature.properties.opacity = get(defaultOpacity);
            }
            if (!feature.properties.width) {
                feature.properties.width = get(defaultWidth);
            }
            if (get(selection).hasAnyParent(new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)) || get(selection).hasAnyChildren(new ListWaypointsItem(this.fileId), true)) {
                feature.properties.width = feature.properties.width + 2;
                feature.properties.opacity = Math.min(1, feature.properties.opacity + 0.1);
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