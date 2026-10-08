import { get, type Readable } from 'svelte/store';
import maplibregl, {
    type GeoJSONSource,
    type FilterSpecification,
    type MapLayerMouseEvent,
    type MapLayerTouchEvent,
} from 'maplibre-gl';
import { map } from '$lib/components/map/map';
import { waypointPopup, trackpointPopup } from './gpx-layer-popup';
import { closestPointIndex } from '$lib/closest-point';
import { getElevation, loadSVGIcon } from '$lib/utils';
import { selectedWaypoint } from '$lib/components/toolbar/tools/waypoint/waypoint';
import { MapPin, Square } from 'lucide-static';
import { getSymbolKey, symbols } from '$lib/assets/symbols';
import { engine, type FileState, type Selection } from '$lib/engine';
import { isCovered, hasSelectionWithin, type FileTreeNode } from '$lib/selection-helpers';
import { isSegmentHidden, isWaypointHidden } from '$lib/file-visibility';
import { settings } from '$lib/logic/settings';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { splitAtPoint } from '$lib/components/toolbar/tools/scissors/scissors';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';

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
    file: Readable<FileState>;
    layerColor: string = '';
    selectionState: Selection = { type: 'empty' };
    selected: boolean = false;
    currentWaypointData: GeoJSON.FeatureCollection | null = null;
    draggedWaypointIndex: number | null = null;
    draggingStartingPosition: maplibregl.Point = new maplibregl.Point(0, 0);
    unsubscribe: Function[] = [];

    updateBinded: () => void = this.update.bind(this);
    layerOnMouseEnterBinded: (e: any) => void = this.layerOnMouseEnter.bind(this);
    layerOnMouseLeaveBinded: () => void = this.layerOnMouseLeave.bind(this);
    layerOnMouseMoveBinded: (e: any) => void = this.layerOnMouseMove.bind(this);
    layerOnClickBinded: (e: MapLayerMouseEvent) => void = this.layerOnClick.bind(this);
    layerOnContextMenuBinded: (e: MapLayerMouseEvent) => void = this.layerOnContextMenu.bind(this);
    waypointLayerOnMouseEnterBinded: (e: MapLayerMouseEvent) => void =
        this.waypointLayerOnMouseEnter.bind(this);
    waypointLayerOnMouseLeaveBinded: (e: MapLayerMouseEvent) => void =
        this.waypointLayerOnMouseLeave.bind(this);
    waypointLayerOnClickBinded: (e: MapLayerMouseEvent) => void =
        this.waypointLayerOnClick.bind(this);
    waypointLayerOnMouseDownBinded: (e: MapLayerMouseEvent) => void =
        this.waypointLayerOnMouseDown.bind(this);
    waypointLayerOnTouchStartBinded: (e: MapLayerTouchEvent) => void =
        this.waypointLayerOnTouchStart.bind(this);
    waypointLayerOnMouseMoveBinded: (e: MapLayerMouseEvent | MapLayerTouchEvent) => void =
        this.waypointLayerOnMouseMove.bind(this);
    waypointLayerOnMouseUpBinded: (e: MapLayerMouseEvent | MapLayerTouchEvent) => void =
        this.waypointLayerOnMouseUp.bind(this);

    constructor(fileId: string, file: Readable<FileState>) {
        this.fileId = fileId;
        this.file = file;
        this.unsubscribe.push(
            map.subscribe(($map) => {
                if ($map) {
                    $map.on('style.load', this.updateBinded);
                    this.update();
                }
            })
        );
        this.unsubscribe.push(file.subscribe(this.updateBinded));
        this.unsubscribe.push(
            engine.selection.subscribe(($selection) => {
                this.selectionState = $selection;
                let newSelected = hasSelectionWithin($selection, this.fileNode());
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

    fileNode(): FileTreeNode {
        return { type: 'file', fileId: this.fileId };
    }

    segmentNode(properties: GeoJSON.GeoJsonProperties): FileTreeNode {
        return {
            type: 'segment',
            fileId: this.fileId,
            trackId: properties!.trackId,
            segmentId: properties!.segmentId,
        };
    }

    update() {
        const _map = get(map);
        const layerEventManager = map.layerEventManager;
        const state = get(this.file);
        if (!_map || !layerEventManager) {
            return;
        }

        if (this.layerColor !== state.color) {
            this.layerColor = state.color;
        }

        this.loadIcons();

        try {
            let source = _map.getSource(this.fileId) as GeoJSONSource | undefined;
            if (source) {
                source.setData(this.getGeoJSON());
            } else {
                _map.addSource(this.fileId, {
                    type: 'geojson',
                    data: this.getGeoJSON(),
                });
            }

            if (!_map.getLayer(this.fileId)) {
                _map.addLayer(
                    {
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
                    },
                    ANCHOR_LAYER_KEY.tracks
                );

                layerEventManager.on('click', this.fileId, this.layerOnClickBinded);
                layerEventManager.on('contextmenu', this.fileId, this.layerOnContextMenuBinded);
                layerEventManager.on('mouseenter', this.fileId, this.layerOnMouseEnterBinded);
                layerEventManager.on('mouseleave', this.fileId, this.layerOnMouseLeaveBinded);
                layerEventManager.on('mousemove', this.fileId, this.layerOnMouseMoveBinded);
            }

            const visibleSegmentIds = state.segments.features
                .filter(
                    ({ properties }) =>
                        !isSegmentHidden(state, properties.trackId, properties.segmentId)
                )
                .map(({ properties }) => properties.segmentId);
            const segmentFilter: FilterSpecification = [
                'in',
                ['get', 'segmentId'],
                ['literal', visibleSegmentIds],
            ];

            _map.setFilter(this.fileId, segmentFilter, { validate: false });

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
                                'text-font': ['Noto Sans Bold'],
                                'symbol-placement': 'line',
                                'symbol-spacing': 20,
                            },
                            paint: {
                                'text-color': 'white',
                                'text-halo-width': 0.2,
                                'text-halo-color': 'white',
                            },
                        },
                        ANCHOR_LAYER_KEY.directionMarkers
                    );
                }

                _map.setFilter(this.fileId + '-direction', segmentFilter, { validate: false });
            } else {
                if (_map.getLayer(this.fileId + '-direction')) {
                    _map.removeLayer(this.fileId + '-direction');
                }
            }

            let waypointSource = _map.getSource(this.fileId + '-waypoints') as
                | GeoJSONSource
                | undefined;
            this.currentWaypointData = this.getWaypointsGeoJSON();
            if (waypointSource) {
                waypointSource.setData(this.currentWaypointData);
            } else {
                _map.addSource(this.fileId + '-waypoints', {
                    type: 'geojson',
                    data: this.currentWaypointData,
                    promoteId: 'waypointIndex',
                });
            }

            if (!_map.getLayer(this.fileId + '-waypoints')) {
                _map.addLayer(
                    {
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
                    },
                    ANCHOR_LAYER_KEY.waypoints
                );

                layerEventManager.on(
                    'mouseenter',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnMouseEnterBinded
                );
                layerEventManager.on(
                    'mouseleave',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnMouseLeaveBinded
                );
                layerEventManager.on(
                    'click',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnClickBinded
                );
                layerEventManager.on(
                    'mousedown',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnMouseDownBinded
                );
                layerEventManager.on(
                    'touchstart',
                    this.fileId + '-waypoints',
                    this.waypointLayerOnTouchStartBinded
                );
            }

            const visibleWaypoints = state.waypoints.features
                .filter(({ properties }) => !isWaypointHidden(state, properties.waypointId))
                .map(({ properties }) => properties.index);

            _map.setFilter(
                this.fileId + '-waypoints',
                ['in', ['get', 'waypointIndex'], ['literal', visibleWaypoints]],
                { validate: false }
            );
        } catch (e) {
            // No reliable way to check if the map is ready to add sources and layers
            return;
        }
    }

    remove() {
        const _map = get(map);

        if (_map) {
            _map.off('style.load', this.updateBinded);
        }

        const layerEventManager = map.layerEventManager;
        if (layerEventManager) {
            layerEventManager.off('click', this.fileId, this.layerOnClickBinded);
            layerEventManager.off('contextmenu', this.fileId, this.layerOnContextMenuBinded);
            layerEventManager.off('mouseenter', this.fileId, this.layerOnMouseEnterBinded);
            layerEventManager.off('mouseleave', this.fileId, this.layerOnMouseLeaveBinded);
            layerEventManager.off('mousemove', this.fileId, this.layerOnMouseMoveBinded);

            layerEventManager.off(
                'mouseenter',
                this.fileId + '-waypoints',
                this.waypointLayerOnMouseEnterBinded
            );
            layerEventManager.off(
                'mouseleave',
                this.fileId + '-waypoints',
                this.waypointLayerOnMouseLeaveBinded
            );
            layerEventManager.off(
                'click',
                this.fileId + '-waypoints',
                this.waypointLayerOnClickBinded
            );
            layerEventManager.off(
                'mousedown',
                this.fileId + '-waypoints',
                this.waypointLayerOnMouseDownBinded
            );
            layerEventManager.off(
                'touchstart',
                this.fileId + '-waypoints',
                this.waypointLayerOnTouchStartBinded
            );
        }

        if (_map) {
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
    }

    moveToFront() {
        const _map = get(map);
        if (!_map) {
            return;
        }
        if (_map.getLayer(this.fileId)) {
            _map.moveLayer(this.fileId, ANCHOR_LAYER_KEY.tracks);
        }
        if (_map.getLayer(this.fileId + '-waypoints')) {
            _map.moveLayer(this.fileId + '-waypoints', ANCHOR_LAYER_KEY.waypoints);
        }
        if (_map.getLayer(this.fileId + '-direction')) {
            _map.moveLayer(this.fileId + '-direction', ANCHOR_LAYER_KEY.directionMarkers);
        }
    }

    layerOnMouseEnter(e: any) {
        if (
            get(currentTool) === Tool.SCISSORS &&
            isCovered(this.selectionState, this.segmentNode(e.features[0].properties))
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
            const { segmentId } = e.features[0].properties;
            const lngLat = { lng: e.lngLat.lng, lat: e.lngLat.lat };
            const index = closestPointIndex(engine.segmentCoordinates(segmentId), lngLat);
            const trackpoint =
                index === undefined ? undefined : engine.trackpoint(this.fileId, segmentId, index);
            if (trackpoint) {
                trackpointPopup?.setItem({
                    item: trackpoint,
                    kind: 'trackpoint',
                    fileId: this.fileId,
                });
            }
        }
    }

    layerOnClick(e: MapLayerMouseEvent) {
        const properties = e.features![0].properties!;
        const { trackId, segmentId } = properties;
        const selectionType = this.selectionState.type;

        if (
            get(currentTool) === Tool.ROUTING &&
            selectionType !== 'empty' &&
            selectionType !== 'waypoints' &&
            selectionType !== 'waypoint'
        ) {
            return;
        }

        if (
            get(currentTool) === Tool.SCISSORS &&
            isCovered(this.selectionState, this.segmentNode(properties))
        ) {
            if (get(map)?.queryRenderedFeatures(e.point, { layers: ['split-controls'] }).length) {
                // Clicked on split control, ignoring
                return;
            }

            splitAtPoint(segmentId, { lng: e.lngLat.lng, lat: e.lngLat.lat });
            return;
        }

        const mode = e.originalEvent.ctrlKey || e.originalEvent.metaKey ? 'add' : 'replace';
        const { tracks } = get(this.file).structure;
        const segmentCount = tracks.reduce((count, track) => count + track.segments.length, 0);
        if (get(treeFileView) && segmentCount > 1) {
            // Select inner item
            const track = tracks.find((track) => track.id === trackId);
            if (track && track.segments.length > 1) {
                engine.selectSegments(this.fileId, trackId, [segmentId], mode);
            } else {
                engine.selectTracks(this.fileId, [trackId], mode);
            }
        } else {
            engine.select([this.fileId], mode);
        }
    }

    layerOnContextMenu(e: any) {
        if (e.originalEvent.ctrlKey) {
            this.layerOnClick(e);
        }
    }

    waypointLayerOnMouseEnter(e: MapLayerMouseEvent) {
        if (this.draggedWaypointIndex !== null) {
            return;
        }

        this.showWaypointPopup(e.features![0].properties!.waypointId);

        mapCursor.notify(MapCursorState.WAYPOINT_HOVER, true);
    }

    showWaypointPopup(waypointId: string) {
        const waypoint = engine.waypoint(this.fileId, waypointId);
        if (waypoint) {
            waypointPopup?.setItem({ item: waypoint, kind: 'waypoint', fileId: this.fileId });
        }
    }

    waypointLayerOnMouseLeave() {
        mapCursor.notify(MapCursorState.WAYPOINT_HOVER, false);
    }

    waypointLayerOnClick(e: MapLayerMouseEvent) {
        e.preventDefault();

        const { waypointId } = e.features![0].properties!;
        if (get(currentTool) === Tool.WAYPOINT) {
            if (this.selected) {
                if (e.originalEvent.shiftKey) {
                    engine.deleteWaypoint(this.fileId, waypointId);
                } else {
                    engine.selectWaypoints(this.fileId, [waypointId]);
                    selectedWaypoint.set({ fileId: this.fileId, id: waypointId });
                }
            } else {
                if (get(treeFileView)) {
                    engine.selectWaypoints(this.fileId, [waypointId]);
                } else {
                    engine.select([this.fileId]);
                }
                selectedWaypoint.set({ fileId: this.fileId, id: waypointId });
            }
        } else {
            if (get(treeFileView)) {
                const add = e.originalEvent.ctrlKey || e.originalEvent.metaKey;
                engine.selectWaypoints(
                    this.fileId,
                    [waypointId],
                    add && this.selected ? 'add' : 'replace'
                );
            } else {
                if (!this.selected) {
                    engine.select([this.fileId]);
                }
                this.showWaypointPopup(waypointId);
            }
        }
    }

    waypointLayerOnMouseDown(e: MapLayerMouseEvent) {
        if (get(currentTool) !== Tool.WAYPOINT || !this.selected) {
            return;
        }
        const _map = get(map);
        if (!_map) {
            return;
        }

        e.preventDefault();
        _map.dragPan.disable();

        this.draggedWaypointIndex = e.features![0].properties!.waypointIndex;
        this.draggingStartingPosition = e.point;
        waypointPopup?.hide();

        _map.on('mousemove', this.waypointLayerOnMouseMoveBinded);
        _map.once('mouseup', this.waypointLayerOnMouseUpBinded);
    }

    waypointLayerOnTouchStart(e: MapLayerTouchEvent) {
        if (e.points.length !== 1 || get(currentTool) !== Tool.WAYPOINT || !this.selected) {
            return;
        }
        const _map = get(map);
        if (!_map) {
            return;
        }

        this.draggedWaypointIndex = e.features![0].properties!.waypointIndex;
        this.draggingStartingPosition = e.point;
        waypointPopup?.hide();

        e.preventDefault();
        _map.dragPan.disable();

        _map.on('touchmove', this.waypointLayerOnMouseMoveBinded);
        _map.once('touchend', this.waypointLayerOnMouseUpBinded);
    }

    waypointLayerOnMouseMove(e: MapLayerMouseEvent | MapLayerTouchEvent) {
        if (this.draggedWaypointIndex === null || e.point.equals(this.draggingStartingPosition)) {
            return;
        }

        mapCursor.notify(MapCursorState.WAYPOINT_DRAGGING, true);

        (
            this.currentWaypointData!.features[this.draggedWaypointIndex].geometry as GeoJSON.Point
        ).coordinates = [e.lngLat.lng, e.lngLat.lat];

        let waypointSource = get(map)?.getSource(this.fileId + '-waypoints') as
            | GeoJSONSource
            | undefined;
        if (waypointSource) {
            waypointSource.updateData({
                update: [
                    {
                        id: this.draggedWaypointIndex,
                        newGeometry: {
                            type: 'Point',
                            coordinates: [e.lngLat.lng, e.lngLat.lat],
                        },
                    },
                ],
            });
        }
    }

    waypointLayerOnMouseUp(e: MapLayerMouseEvent | MapLayerTouchEvent) {
        mapCursor.notify(MapCursorState.WAYPOINT_DRAGGING, false);

        const _map = get(map);
        if (!_map) {
            return;
        }

        _map.dragPan.enable();

        _map.off('mousemove', this.waypointLayerOnMouseMoveBinded);
        _map.off('touchmove', this.waypointLayerOnMouseMoveBinded);

        if (this.draggedWaypointIndex === null) {
            return;
        }
        if (e.point.equals(this.draggingStartingPosition)) {
            this.draggedWaypointIndex = null;
            return;
        }

        // the dragged waypoint, as it is in the features of the source
        const waypointId =
            this.currentWaypointData?.features[this.draggedWaypointIndex].properties?.waypointId;
        getElevation([
            {
                lat: e.lngLat.lat,
                lng: e.lngLat.lng,
            },
        ]).then(async (ele) => {
            if (this.draggedWaypointIndex === null) {
                return;
            }
            if (waypointId) {
                await engine.moveWaypoint(
                    this.fileId,
                    waypointId,
                    e.lngLat.lng,
                    e.lngLat.lat,
                    ele[0]
                );
            }
            this.draggedWaypointIndex = null;
        });
    }

    getGeoJSON(): GeoJSON.FeatureCollection {
        const state = get(this.file);
        const waypointsSelected = hasSelectionWithin(this.selectionState, {
            type: 'waypoints',
            fileId: this.fileId,
        });

        return {
            type: 'FeatureCollection',
            features: state.segments.features.map((feature) => {
                const properties = {
                    ...feature.properties,
                    opacity: feature.properties.opacity ?? get(defaultOpacity),
                    width: feature.properties.width ?? get(defaultWidth),
                };
                if (
                    isCovered(this.selectionState, this.segmentNode(properties)) ||
                    waypointsSelected
                ) {
                    properties.width = properties.width + 2;
                    properties.opacity = Math.min(1, properties.opacity + 0.1);
                }
                return { ...feature, properties };
            }),
        };
    }

    getWaypointsGeoJSON(): GeoJSON.FeatureCollection {
        return {
            type: 'FeatureCollection',
            features: get(this.file).waypoints.features.map((feature) => ({
                type: 'Feature',
                // copied: the coordinates are changed while a waypoint is dragged
                geometry: { type: 'Point', coordinates: [...feature.geometry.coordinates] },
                properties: {
                    fileId: this.fileId,
                    waypointId: feature.properties.waypointId,
                    waypointIndex: feature.properties.index,
                    icon: `waypoint-${getSymbolKey(feature.properties.sym) ?? 'default'}-${this.layerColor}`,
                },
            })),
        };
    }

    loadIcons() {
        const _map = get(map);
        if (!_map) {
            return;
        }

        let symbols = new Set<string | undefined>();
        get(this.file).waypoints.features.forEach((feature) => {
            symbols.add(getSymbolKey(feature.properties.sym));
        });

        symbols.forEach((symbol) => {
            const iconId = `waypoint-${symbol ?? 'default'}-${this.layerColor}`;
            loadSVGIcon(_map, iconId, getSvgForSymbol(symbol, this.layerColor));
        });
    }
}
