import { get, type Readable } from 'svelte/store';
import mapboxgl from 'mapbox-gl';
import { map } from '$lib/components/map/map';
import { waypointPopup, trackpointPopup } from './gpx-layer-popup';
import {
    ListTrackSegmentItem,
    ListWaypointItem,
    ListWaypointsItem,
    ListTrackItem,
    ListFileItem,
    ListRootItem,
} from '$lib/components/file-list/file-list';
import { getClosestLinePoint, getElevation } from '$lib/utils';
import { selectedWaypoint } from '$lib/components/toolbar/tools/waypoint/waypoint';
import { MapPin, Square } from 'lucide-static';
import { getSymbolKey, symbols } from '$lib/assets/symbols';
import type { GPXFileWithStatistics } from '$lib/logic/statistics-tree';
import { selection } from '$lib/logic/selection';
import { settings } from '$lib/logic/settings';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { fileActionManager } from '$lib/logic/file-action-manager';
import { fileActions } from '$lib/logic/file-actions';
import { splitAs } from '$lib/components/toolbar/tools/scissors/scissors';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';

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
    '#8c645a',
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

export function getSvgForSymbol(symbol?: string | undefined, layerColor?: string | undefined) {
    let symbolSvg = symbol ? symbols[symbol]?.iconSvg : undefined;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    ${
        layerColor
            ? Square.replace('width="24"', 'width="12"')
                  .replace('height="24"', 'height="12"')
                  .replace('stroke="currentColor"', 'stroke="SteelBlue"')
                  .replace('stroke-width="2"', 'stroke-width="1.5" x="9.6" y="0.4"')
                  .replace('fill="none"', `fill="${layerColor}"`)
            : ''
    }
    ${MapPin.replace('width="24"', '')
        .replace('height="24"', '')
        .replace('stroke="currentColor"', '')
        .replace('path', `path fill="#3fb1ce" stroke="SteelBlue" stroke-width="1"`)
        .replace(
            'circle',
            `circle fill="${symbolSvg ? 'none' : 'white'}" stroke="${symbolSvg ? 'none' : 'white'}" stroke-width="2"`
        )} 
    ${
        symbolSvg
            ?.replace('width="24"', 'width="10"')
            .replace('height="24"', 'height="10"')
            .replace('stroke="currentColor"', 'stroke="white"')
            .replace('stroke-width="2"', 'stroke-width="2.5" x="7" y="5"') ?? ''
    }
    </svg>`;
}

const { directionMarkers, treeFileView, defaultOpacity, defaultWidth } = settings;

export class GPXLayer {
    fileId: string;
    file: Readable<GPXFileWithStatistics | undefined>;
    layerColor: string;
    selected: boolean = false;
    currentWaypointData: GeoJSON.FeatureCollection | null = null;
    draggedWaypointIndex: number | null = null;
    draggingStartingPosition: mapboxgl.Point = new mapboxgl.Point(0, 0);
    unsubscribe: Function[] = [];

    updateBinded: () => void = this.update.bind(this);
    layerOnMouseEnterBinded: (e: any) => void = this.layerOnMouseEnter.bind(this);
    layerOnMouseLeaveBinded: () => void = this.layerOnMouseLeave.bind(this);
    layerOnMouseMoveBinded: (e: any) => void = this.layerOnMouseMove.bind(this);
    layerOnClickBinded: (e: any) => void = this.layerOnClick.bind(this);
    layerOnContextMenuBinded: (e: any) => void = this.layerOnContextMenu.bind(this);
    waypointLayerOnMouseEnterBinded: (e: mapboxgl.MapMouseEvent) => void =
        this.waypointLayerOnMouseEnter.bind(this);
    waypointLayerOnMouseLeaveBinded: (e: mapboxgl.MapMouseEvent) => void =
        this.waypointLayerOnMouseLeave.bind(this);
    waypointLayerOnClickBinded: (e: mapboxgl.MapMouseEvent) => void =
        this.waypointLayerOnClick.bind(this);
    waypointLayerOnMouseDownBinded: (e: mapboxgl.MapMouseEvent) => void =
        this.waypointLayerOnMouseDown.bind(this);
    waypointLayerOnTouchStartBinded: (e: mapboxgl.MapTouchEvent) => void =
        this.waypointLayerOnTouchStart.bind(this);
    waypointLayerOnMouseMoveBinded: (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => void =
        this.waypointLayerOnMouseMove.bind(this);
    waypointLayerOnMouseUpBinded: (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => void =
        this.waypointLayerOnMouseUp.bind(this);

    constructor(fileId: string, file: Readable<GPXFileWithStatistics | undefined>) {
        this.fileId = fileId;
        this.file = file;
        this.layerColor = getColor();
        this.unsubscribe.push(
            map.subscribe(($map) => {
                if ($map) {
                    $map.on('style.import.load', this.updateBinded);
                    this.update();
                }
            })
        );
        this.unsubscribe.push(file.subscribe(this.updateBinded));
        this.unsubscribe.push(
            selection.subscribe(($selection) => {
                let newSelected = $selection.hasAnyChildren(new ListFileItem(this.fileId));
                if (this.selected || newSelected) {
                    this.selected = newSelected;
                    this.update();
                }
                if (newSelected) {
                    this.moveToFront();
                }
            })
        );
        this.unsubscribe.push(directionMarkers.subscribe(this.updateBinded));
    }

    update() {
        const _map = get(map);
        let file = get(this.file)?.file;
        if (!_map || !file) {
            return;
        }

        this.loadIcons();

        if (
            file._data.style &&
            file._data.style.color &&
            this.layerColor !== `#${file._data.style.color}`
        ) {
            decrementColor(this.layerColor);
            this.layerColor = `#${file._data.style.color}`;
        }

        try {
            let source = _map.getSource(this.fileId) as mapboxgl.GeoJSONSource | undefined;
            if (source) {
                source.setData(this.getGeoJSON());
            } else {
                _map.addSource(this.fileId, {
                    type: 'geojson',
                    data: this.getGeoJSON(),
                });
            }

            if (!_map.getLayer(this.fileId)) {
                _map.addLayer({
                    id: this.fileId,
                    type: 'line',
                    source: this.fileId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                    },
                    paint: {
                        'line-color': ['get', 'color'],
                        'line-width': ['get', 'width'],
                        'line-opacity': ['get', 'opacity'],
                    },
                });

                _map.on('click', this.fileId, this.layerOnClickBinded);
                _map.on('contextmenu', this.fileId, this.layerOnContextMenuBinded);
                _map.on('mouseenter', this.fileId, this.layerOnMouseEnterBinded);
                _map.on('mouseleave', this.fileId, this.layerOnMouseLeaveBinded);
                _map.on('mousemove', this.fileId, this.layerOnMouseMoveBinded);
            }

            let waypointSource = _map.getSource(this.fileId + '-waypoints') as
                | mapboxgl.GeoJSONSource
                | undefined;
            this.currentWaypointData = this.getWaypointsGeoJSON();
            if (waypointSource) {
                waypointSource.setData(this.currentWaypointData);
            } else {
                _map.addSource(this.fileId + '-waypoints', {
                    type: 'geojson',
                    data: this.currentWaypointData,
                });
            }

            if (!_map.getLayer(this.fileId + '-waypoints')) {
                _map.addLayer({
                    id: this.fileId + '-waypoints',
                    type: 'symbol',
                    source: this.fileId + '-waypoints',
                    layout: {
                        'icon-image': ['get', 'icon'],
                        'icon-size': 0.3,
                        'icon-anchor': 'bottom',
                        'icon-padding': 0,
                        'icon-allow-overlap': true,
                    },
                });

                _map.on(
                    'mouseenter',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnMouseEnterBinded
                );
                _map.on(
                    'mouseleave',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnMouseLeaveBinded
                );
                _map.on('click', this.fileId + '-waypoints', this.waypointLayerOnClickBinded);
                _map.on(
                    'mousedown',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnMouseDownBinded
                );
                _map.on('touchstart', this.waypointLayerOnTouchStartBinded);
            }

            if (get(directionMarkers)) {
                if (!_map.getLayer(this.fileId + '-direction')) {
                    _map.addLayer(
                        {
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
                                'text-halo-color': 'white',
                            },
                        },
                        _map.getLayer('distance-markers') ? 'distance-markers' : undefined
                    );
                }
            } else {
                if (_map.getLayer(this.fileId + '-direction')) {
                    _map.removeLayer(this.fileId + '-direction');
                }
            }

            let visibleSegments: [number, number][] = [];
            file.forEachSegment((segment, trackIndex, segmentIndex) => {
                if (!segment._data.hidden) {
                    visibleSegments.push([trackIndex, segmentIndex]);
                }
            });

            _map.setFilter(
                this.fileId,
                [
                    'any',
                    ...visibleSegments.map(([trackIndex, segmentIndex]) => [
                        'all',
                        ['==', 'trackIndex', trackIndex],
                        ['==', 'segmentIndex', segmentIndex],
                    ]),
                ],
                { validate: false }
            );

            let visibleWaypoints: number[] = [];
            file.wpt.forEach((waypoint, waypointIndex) => {
                if (!waypoint._data.hidden) {
                    visibleWaypoints.push(waypointIndex);
                }
            });

            _map.setFilter(
                this.fileId + '-waypoints',
                ['in', ['get', 'waypointIndex'], ['literal', visibleWaypoints]],
                { validate: false }
            );

            if (_map.getLayer(this.fileId + '-direction')) {
                _map.setFilter(
                    this.fileId + '-direction',
                    [
                        'any',
                        ...visibleSegments.map(([trackIndex, segmentIndex]) => [
                            'all',
                            ['==', 'trackIndex', trackIndex],
                            ['==', 'segmentIndex', segmentIndex],
                        ]),
                    ],
                    { validate: false }
                );
            }
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
            return;
        }
    }

    remove() {
        const _map = get(map);
        if (_map) {
            _map.off('click', this.fileId, this.layerOnClickBinded);
            _map.off('contextmenu', this.fileId, this.layerOnContextMenuBinded);
            _map.off('mouseenter', this.fileId, this.layerOnMouseEnterBinded);
            _map.off('mouseleave', this.fileId, this.layerOnMouseLeaveBinded);
            _map.off('mousemove', this.fileId, this.layerOnMouseMoveBinded);
            _map.off('style.import.load', this.updateBinded);

            _map.off(
                'mouseenter',
                this.fileId + '-waypoints',
                this.waypointLayerOnMouseEnterBinded
            );
            _map.off(
                'mouseleave',
                this.fileId + '-waypoints',
                this.waypointLayerOnMouseLeaveBinded
            );
            _map.off('click', this.fileId + '-waypoints', this.waypointLayerOnClickBinded);
            _map.off('mousedown', this.fileId + '-waypoints', this.waypointLayerOnMouseDownBinded);
            _map.off('touchstart', this.waypointLayerOnTouchStartBinded);

            if (_map.getLayer(this.fileId + '-direction')) {
                _map.removeLayer(this.fileId + '-direction');
            }
            if (_map.getLayer(this.fileId)) {
                _map.removeLayer(this.fileId);
            }
            if (_map.getSource(this.fileId)) {
                _map.removeSource(this.fileId);
            }
            if (_map.getLayer(this.fileId + '-waypoints')) {
                _map.removeLayer(this.fileId + '-waypoints');
            }
            if (_map.getSource(this.fileId + '-waypoints')) {
                _map.removeSource(this.fileId + '-waypoints');
            }
        }

        this.unsubscribe.forEach((unsubscribe) => unsubscribe());

        decrementColor(this.layerColor);
    }

    moveToFront() {
        const _map = get(map);
        if (!_map) {
            return;
        }
        if (_map.getLayer(this.fileId)) {
            _map.moveLayer(this.fileId);
        }
        if (_map.getLayer(this.fileId + '-waypoints')) {
            _map.moveLayer(this.fileId + '-waypoints');
        }
        if (_map.getLayer(this.fileId + '-direction')) {
            _map.moveLayer(this.fileId + '-direction');
        }
    }

    layerOnMouseEnter(e: any) {
        let trackIndex = e.features[0].properties.trackIndex;
        let segmentIndex = e.features[0].properties.segmentIndex;

        if (
            get(currentTool) === Tool.SCISSORS &&
            get(selection).hasAnyParent(
                new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)
            )
        ) {
            mapCursor.notify(MapCursorState.SCISSORS, true);
        } else {
            mapCursor.notify(MapCursorState.LAYER_HOVER, true);
        }
    }

    layerOnMouseLeave() {
        mapCursor.notify(MapCursorState.SCISSORS, false);
        mapCursor.notify(MapCursorState.LAYER_HOVER, false);
    }

    layerOnMouseMove(e: any) {
        if (e.originalEvent.shiftKey) {
            let trackIndex = e.features[0].properties.trackIndex;
            let segmentIndex = e.features[0].properties.segmentIndex;

            const file = get(this.file)?.file;
            if (file) {
                const closest = getClosestLinePoint(
                    file.trk[trackIndex].trkseg[segmentIndex].trkpt,
                    { lat: e.lngLat.lat, lon: e.lngLat.lng }
                );
                trackpointPopup?.setItem({ item: closest, fileId: this.fileId });
            }
        }
    }

    layerOnClick(e: mapboxgl.MapMouseEvent) {
        if (
            get(currentTool) === Tool.ROUTING &&
            get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints'])
        ) {
            return;
        }

        let trackIndex = e.features![0].properties!.trackIndex;
        let segmentIndex = e.features![0].properties!.segmentIndex;

        if (
            get(currentTool) === Tool.SCISSORS &&
            get(selection).hasAnyParent(
                new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)
            )
        ) {
            if (get(map)?.queryRenderedFeatures(e.point, { layers: ['split-controls'] }).length) {
                // Clicked on split control, ignoring
                return;
            }

            fileActions.split(get(splitAs), this.fileId, trackIndex, segmentIndex, {
                lat: e.lngLat.lat,
                lon: e.lngLat.lng,
            });
            return;
        }

        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let item = undefined;
        if (get(treeFileView) && file.getSegments().length > 1) {
            // Select inner item
            item =
                file.children[trackIndex].children.length > 1
                    ? new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)
                    : new ListTrackItem(this.fileId, trackIndex);
        } else {
            item = new ListFileItem(this.fileId);
        }

        if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
            selection.addSelectItem(item);
        } else {
            selection.selectItem(item);
        }
    }

    layerOnContextMenu(e: any) {
        if (e.originalEvent.ctrlKey) {
            this.layerOnClick(e);
        }
    }

    waypointLayerOnMouseEnter(e: mapboxgl.MapMouseEvent) {
        if (this.draggedWaypointIndex !== null) {
            return;
        }
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let waypointIndex = e.features![0].properties!.waypointIndex;
        let waypoint = file.wpt[waypointIndex];
        waypointPopup?.setItem({ item: waypoint, fileId: this.fileId });

        mapCursor.notify(MapCursorState.WAYPOINT_HOVER, true);
    }

    waypointLayerOnMouseLeave() {
        mapCursor.notify(MapCursorState.WAYPOINT_HOVER, false);
    }

    waypointLayerOnClick(e: mapboxgl.MapMouseEvent) {
        e.preventDefault();

        let waypointIndex = e.features![0].properties!.waypointIndex;
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let waypoint = file.wpt[waypointIndex];
        if (get(currentTool) === Tool.WAYPOINT) {
            if (this.selected) {
                if (e.originalEvent.shiftKey) {
                    fileActions.deleteWaypoint(this.fileId, waypointIndex);
                } else {
                    selection.selectItem(new ListWaypointItem(this.fileId, waypointIndex));
                    selectedWaypoint.set([waypoint, this.fileId]);
                }
            } else {
                if (get(treeFileView)) {
                    selection.selectItem(new ListWaypointItem(this.fileId, waypointIndex));
                } else {
                    selection.selectItem(new ListFileItem(this.fileId));
                }
                selectedWaypoint.set([waypoint, this.fileId]);
            }
        } else {
            if (get(treeFileView)) {
                if ((e.originalEvent.ctrlKey || e.originalEvent.metaKey) && this.selected) {
                    selection.addSelectItem(new ListWaypointItem(this.fileId, waypointIndex));
                } else {
                    selection.selectItem(new ListWaypointItem(this.fileId, waypointIndex));
                }
            } else {
                if (!this.selected) {
                    selection.selectItem(new ListFileItem(this.fileId));
                }
                waypointPopup?.setItem({ item: waypoint, fileId: this.fileId });
            }
        }
    }

    waypointLayerOnMouseDown(e: mapboxgl.MapMouseEvent) {
        if (get(currentTool) !== Tool.WAYPOINT || !this.selected) {
            return;
        }
        const _map = get(map);
        if (!_map) {
            return;
        }

        e.preventDefault();

        this.draggedWaypointIndex = e.features![0].properties!.waypointIndex;
        this.draggingStartingPosition = e.point;
        waypointPopup?.hide();

        _map.on('mousemove', this.waypointLayerOnMouseMoveBinded);
        _map.once('mouseup', this.waypointLayerOnMouseUpBinded);
    }

    waypointLayerOnTouchStart(e: mapboxgl.MapTouchEvent) {
        if (e.points.length !== 1) {
            return;
        }
        if (get(currentTool) !== Tool.WAYPOINT || !this.selected) {
            return;
        }
        const _map = get(map);
        if (!_map) {
            return;
        }

        let features = _map.queryRenderedFeatures(e.point, {
            layers: [this.fileId + '-waypoints'],
        });
        if (features.length === 0) {
            return;
        }

        this.draggedWaypointIndex = features[0].properties!.waypointIndex;
        this.draggingStartingPosition = e.point;
        waypointPopup?.hide();

        e.preventDefault();

        _map.on('touchmove', this.waypointLayerOnMouseMoveBinded);
        _map.once('touchend', this.waypointLayerOnMouseUpBinded);
    }

    waypointLayerOnMouseMove(e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) {
        if (!this.draggedWaypointIndex || e.point.equals(this.draggingStartingPosition)) {
            return;
        }

        mapCursor.notify(MapCursorState.WAYPOINT_DRAGGING, true);

        (
            this.currentWaypointData!.features[this.draggedWaypointIndex].geometry as GeoJSON.Point
        ).coordinates = [e.lngLat.lng, e.lngLat.lat];

        let waypointSource = get(map)?.getSource(this.fileId + '-waypoints') as
            | mapboxgl.GeoJSONSource
            | undefined;
        if (waypointSource) {
            waypointSource.setData(this.currentWaypointData!);
        }
    }

    waypointLayerOnMouseUp(e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) {
        mapCursor.notify(MapCursorState.WAYPOINT_DRAGGING, false);

        get(map)?.off('mousemove', this.waypointLayerOnMouseMoveBinded);
        get(map)?.off('touchmove', this.waypointLayerOnMouseMoveBinded);

        if (this.draggedWaypointIndex === null) {
            return;
        }
        if (e.point.equals(this.draggingStartingPosition)) {
            this.draggedWaypointIndex = null;
            return;
        }

        getElevation([
            {
                lat: e.lngLat.lat,
                lon: e.lngLat.lng,
            },
        ]).then((ele) => {
            if (this.draggedWaypointIndex === null) {
                return;
            }
            fileActionManager.applyToFile(this.fileId, (file) => {
                let wpt = file.wpt[this.draggedWaypointIndex!];
                wpt.setCoordinates({
                    lat: e.lngLat.lat,
                    lon: e.lngLat.lng,
                });
                wpt.ele = ele[0];
            });
            this.draggedWaypointIndex = null;
        });
    }

    getGeoJSON(): GeoJSON.FeatureCollection {
        let file = get(this.file)?.file;
        if (!file) {
            return {
                type: 'FeatureCollection',
                features: [],
            };
        }

        let data = file.toGeoJSON();

        let trackIndex = 0,
            segmentIndex = 0;
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
            if (
                get(selection).hasAnyParent(
                    new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)
                ) ||
                get(selection).hasAnyChildren(new ListWaypointsItem(this.fileId), true)
            ) {
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

    getWaypointsGeoJSON(): GeoJSON.FeatureCollection {
        let file = get(this.file)?.file;

        let data: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [],
        };

        if (!file) {
            return data;
        }

        file.wpt.forEach((waypoint, index) => {
            data.features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [waypoint.getLongitude(), waypoint.getLatitude()],
                },
                properties: {
                    fileId: this.fileId,
                    waypointIndex: index,
                    icon: `${this.fileId}-waypoint-${getSymbolKey(waypoint.sym) ?? 'default'}`,
                },
            });
        });

        return data;
    }

    loadIcons() {
        const _map = get(map);
        let file = get(this.file)?.file;
        if (!_map || !file) {
            return;
        }

        let symbols = new Set<string | undefined>();
        file.wpt.forEach((waypoint) => {
            symbols.add(getSymbolKey(waypoint.sym));
        });

        symbols.forEach((symbol) => {
            const iconId = `${this.fileId}-waypoint-${symbol ?? 'default'}`;
            if (!_map.hasImage(iconId)) {
                let icon = new Image(100, 100);
                icon.onload = () => {
                    if (!_map.hasImage(iconId)) {
                        _map.addImage(iconId, icon);
                    }
                };

                // Lucide icons are SVG files with a 24x24 viewBox
                // Create a new SVG with a 32x32 viewBox and center the icon in a circle
                icon.src =
                    'data:image/svg+xml,' +
                    encodeURIComponent(getSvgForSymbol(symbol, this.layerColor));
            }
        });
    }
}
