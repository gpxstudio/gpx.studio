import { distance, type Coordinates, TrackPoint, TrackSegment, Track, projectedPoint } from 'gpx';
import { get, writable, type Readable } from 'svelte/store';
import maplibregl, {
    type MapMouseEvent,
    type GeoJSONSource,
    type MapLayerMouseEvent,
    type MapLayerTouchEvent,
} from 'maplibre-gl';
import { route } from './routing';
import { toast } from 'svelte-sonner';
import {
    ListFileItem,
    ListTrackItem,
    ListTrackSegmentItem,
} from '$lib/components/file-list/file-list';
import { getClosestLinePoint, loadSVGIcon } from '$lib/utils';
import type { GPXFileWithStatistics } from '$lib/logic/statistics-tree';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import { settings } from '$lib/logic/settings';
import { selection } from '$lib/logic/selection';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { streetViewEnabled } from '$lib/components/map/street-view-control/utils';
import { fileActionManager } from '$lib/logic/file-action-manager';
import { i18n } from '$lib/i18n.svelte';
import { map } from '$lib/components/map/map';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import { MAX_ANCHOR_ZOOM, MIN_ANCHOR_ZOOM } from './simplify';

const { streetViewSource } = settings;
export const canChangeStart = writable(false);

type AnchorProperties = {
    trackIndex: number;
    segmentIndex: number;
    pointIndex: number;
    anchorIndex: number;
    minZoom: number;
};
type Anchor = GeoJSON.Feature<GeoJSON.Point, AnchorProperties>;

export class RoutingControls {
    active: boolean = false;
    fileId: string = '';
    file: Readable<GPXFileWithStatistics | undefined>;
    layers: Map<
        number,
        {
            id: string;
            anchors: GeoJSON.Feature<GeoJSON.Point, AnchorProperties>[];
        }
    > = new Map();
    anchors: GeoJSON.Feature<GeoJSON.Point, AnchorProperties>[] = [];
    popup: maplibregl.Popup;
    popupElement: HTMLElement;
    fileUnsubscribe: () => void = () => {};
    unsubscribes: Function[] = [];

    appendAnchorBinded: (e: MapMouseEvent) => void = this.appendAnchor.bind(this);

    draggedAnchorIndex: number | null = null;
    draggingStartingPosition: maplibregl.Point = new maplibregl.Point(0, 0);
    onMouseEnterBinded: () => void = this.onMouseEnter.bind(this);
    onMouseLeaveBinded: () => void = this.onMouseLeave.bind(this);
    onClickBinded: (e: MapLayerMouseEvent) => void = this.onClick.bind(this);
    onMouseDownBinded: (e: MapLayerMouseEvent) => void = this.onMouseDown.bind(this);
    onTouchStartBinded: (e: MapLayerTouchEvent) => void = this.onTouchStart.bind(this);
    onMouseMoveBinded: (e: MapLayerMouseEvent | MapLayerTouchEvent) => void =
        this.onMouseMove.bind(this);
    onMouseUpBinded: (e: MapLayerMouseEvent | MapLayerTouchEvent) => void =
        this.onMouseUp.bind(this);

    temporaryAnchor: GeoJSON.Feature<GeoJSON.Point, AnchorProperties> | null = null;
    showTemporaryAnchorBinded: (e: MapLayerMouseEvent) => void =
        this.showTemporaryAnchor.bind(this);
    updateTemporaryAnchorBinded: (e: MapMouseEvent) => void = this.updateTemporaryAnchor.bind(this);

    constructor(
        fileId: string,
        file: Readable<GPXFileWithStatistics | undefined>,
        popup: maplibregl.Popup,
        popupElement: HTMLElement
    ) {
        this.fileId = fileId;
        this.file = file;
        for (let zoom = MIN_ANCHOR_ZOOM; zoom <= MAX_ANCHOR_ZOOM; zoom++) {
            this.layers.set(zoom, {
                id: `routing-controls-${zoom}`,
                anchors: [],
            });
        }
        this.popup = popup;
        this.popupElement = popupElement;

        this.unsubscribes.push(selection.subscribe(this.addIfNeeded.bind(this)));
        this.unsubscribes.push(currentTool.subscribe(this.addIfNeeded.bind(this)));
    }

    addIfNeeded() {
        let routing = get(currentTool) === Tool.ROUTING;
        if (!routing) {
            if (this.active) {
                this.remove();
            }
            return;
        }

        let selected = get(selection).hasAnyChildren(new ListFileItem(this.fileId), true, [
            'waypoints',
        ]);
        if (selected) {
            if (this.active) {
                this.updateControls();
            } else {
                this.add();
            }
        } else if (this.active) {
            this.remove();
        }
    }

    add() {
        const map_ = get(map);
        const layerEventManager = map.layerEventManager;
        if (!map_ || !layerEventManager) {
            return;
        }

        this.active = true;

        this.loadIcons();

        map_.on('click', this.appendAnchorBinded);
        layerEventManager.on('mousemove', this.fileId, this.showTemporaryAnchorBinded);

        this.fileUnsubscribe = this.file.subscribe(this.updateControls.bind(this));
    }

    updateControls() {
        const map_ = get(map);
        const layerEventManager = map.layerEventManager;
        const file = get(this.file)?.file;
        if (!map_ || !layerEventManager || !file) {
            return;
        }

        this.layers.forEach((layer) => (layer.anchors = []));
        this.anchors = [];

        file.forEachSegment((segment, trackIndex, segmentIndex) => {
            if (
                get(selection).hasAnyParent(
                    new ListTrackSegmentItem(this.fileId, trackIndex, segmentIndex)
                )
            ) {
                for (let i = 0; i < segment.trkpt.length; i++) {
                    const point = segment.trkpt[i];
                    if (point._data.anchor) {
                        const anchor: Anchor = {
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [point.getLongitude(), point.getLatitude()],
                            },
                            properties: {
                                trackIndex: trackIndex,
                                segmentIndex: segmentIndex,
                                pointIndex: i,
                                anchorIndex: this.anchors.length,
                                minZoom: point._data.zoom,
                            },
                        };
                        this.layers.get(point._data.zoom)?.anchors.push(anchor);
                        this.anchors.push(anchor);
                    }
                }
            }
        });

        this.layers.forEach((layer, zoom) => {
            try {
                let source = map_.getSource(layer.id) as maplibregl.GeoJSONSource | undefined;
                if (source) {
                    source.setData({
                        type: 'FeatureCollection',
                        features: layer.anchors,
                    });
                } else {
                    map_.addSource(layer.id, {
                        type: 'geojson',
                        data: {
                            type: 'FeatureCollection',
                            features: layer.anchors,
                        },
                        promoteId: 'anchorIndex',
                    });
                }

                if (!map_.getLayer(layer.id)) {
                    map_.addLayer(
                        {
                            id: layer.id,
                            type: 'symbol',
                            source: layer.id,
                            layout: {
                                'icon-image': 'routing-control',
                                'icon-size': 0.25,
                                'icon-padding': 0,
                                'icon-allow-overlap': true,
                            },
                            minzoom: zoom,
                        },
                        ANCHOR_LAYER_KEY.routingControls
                    );

                    layerEventManager.on('mouseenter', layer.id, this.onMouseEnterBinded);
                    layerEventManager.on('mouseleave', layer.id, this.onMouseLeaveBinded);
                    layerEventManager.on('click', layer.id, this.onClickBinded);
                    layerEventManager.on('contextmenu', layer.id, this.onClickBinded);
                    layerEventManager.on('mousedown', layer.id, this.onMouseDownBinded);
                    layerEventManager.on('touchstart', layer.id, this.onTouchStartBinded);
                }
            } catch (e) {
                // No reliable way to check if the map is ready to add sources and layers
                return;
            }
        });
    }

    remove() {
        const map_ = get(map);
        const layerEventManager = map.layerEventManager;

        this.active = false;

        map_?.off('click', this.appendAnchorBinded);
        layerEventManager?.off('mousemove', this.fileId, this.showTemporaryAnchorBinded);
        map_?.off('mousemove', this.updateTemporaryAnchorBinded);

        this.layers.forEach((layer) => {
            try {
                layerEventManager?.off('mouseenter', layer.id, this.onMouseEnterBinded);
                layerEventManager?.off('mouseleave', layer.id, this.onMouseLeaveBinded);
                layerEventManager?.off('click', layer.id, this.onClickBinded);
                layerEventManager?.off('contextmenu', layer.id, this.onClickBinded);
                layerEventManager?.off('mousedown', layer.id, this.onMouseDownBinded);
                layerEventManager?.off('touchstart', layer.id, this.onTouchStartBinded);

                if (map_?.getLayer(layer.id)) {
                    map_?.removeLayer(layer.id);
                }

                if (map_?.getSource(layer.id)) {
                    map_?.removeSource(layer.id);
                }
            } catch (e) {
                // No reliable way to check if the map is ready to remove sources and layers
            }
        });

        this.popup.remove();

        this.fileUnsubscribe();
    }

    async moveAnchor(anchor: Anchor, coordinates: Coordinates) {
        // Move the anchor and update the route from and to the neighbouring anchors
        if (anchor === this.temporaryAnchor) {
            // Temporary anchor, need to find the closest point of the segment and create an anchor for it
            anchor = this.getPermanentAnchor(this.temporaryAnchor);
            this.removeTemporaryAnchor();
        }
        const file = get(this.file)?.file;
        if (!file) {
            return;
        }

        const segment = file.getSegment(
            anchor.properties.trackIndex,
            anchor.properties.segmentIndex
        );
        const initialAnchorCoordinates =
            segment.trkpt[anchor.properties.pointIndex].getCoordinates();

        let [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);

        let anchors = [];
        let targetTrackpoints = [];

        if (previousAnchor !== null) {
            anchors.push(previousAnchor);
            targetTrackpoints.push(segment.trkpt[previousAnchor.properties.pointIndex]);
        }

        anchors.push(anchor);
        targetTrackpoints.push(
            new TrackPoint({
                attributes: coordinates,
            })
        );

        if (nextAnchor !== null) {
            anchors.push(nextAnchor);
            targetTrackpoints.push(segment.trkpt[nextAnchor.properties.pointIndex]);
        }

        let success = await this.routeBetweenAnchors(anchors, targetTrackpoints);

        if (!success && anchor.properties.anchorIndex != this.anchors.length) {
            // Route failed, revert the anchor to the previous position
            this.moveAnchorFeature(anchor.properties.anchorIndex, initialAnchorCoordinates);
        }
    }

    getPermanentAnchor(anchor: Anchor): Anchor {
        const file = get(this.file)?.file;
        if (!file) {
            return anchor;
        }
        const segment = file.getSegment(
            anchor.properties.trackIndex,
            anchor.properties.segmentIndex
        );
        // Find the point closest to the temporary anchor
        const anchorPoint = new TrackPoint({
            attributes: {
                lon: anchor.geometry.coordinates[0],
                lat: anchor.geometry.coordinates[1],
            },
        });
        let details: any = {};
        let closest = getClosestLinePoint(segment.trkpt, anchorPoint, details);

        let permanentAnchor: Anchor = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [closest.getLongitude(), closest.getLatitude()],
            },
            properties: {
                trackIndex: anchor.properties.trackIndex,
                segmentIndex: anchor.properties.segmentIndex,
                pointIndex: closest._data.index,
                anchorIndex: this.anchors.length,
                minZoom: 0,
            },
        };

        return permanentAnchor;
    }

    turnIntoPermanentAnchor() {
        const file = get(this.file)?.file;
        if (!file || !this.temporaryAnchor) {
            return;
        }
        const segment = file.getSegment(
            this.temporaryAnchor.properties.trackIndex,
            this.temporaryAnchor.properties.segmentIndex
        );
        // Find the point closest to the temporary anchor
        const anchorPoint = new TrackPoint({
            attributes: {
                lon: this.temporaryAnchor.geometry.coordinates[0],
                lat: this.temporaryAnchor.geometry.coordinates[1],
            },
        });
        let details: any = {};
        getClosestLinePoint(segment.trkpt, anchorPoint, details);

        let before = details.before ? details.index : details.index - 1;

        let projectedPt = projectedPoint(
            segment.trkpt[before],
            segment.trkpt[before + 1],
            anchorPoint
        );
        let ratio =
            distance(segment.trkpt[before], projectedPt) /
            distance(segment.trkpt[before], segment.trkpt[before + 1]);

        let point = segment.trkpt[before].clone();
        point.setCoordinates(projectedPt);
        point.ele =
            (1 - ratio) * (segment.trkpt[before].ele ?? 0) +
            ratio * (segment.trkpt[before + 1].ele ?? 0);
        point.time =
            segment.trkpt[before].time && segment.trkpt[before + 1].time
                ? new Date(
                      (1 - ratio) * segment.trkpt[before].time.getTime() +
                          ratio * segment.trkpt[before + 1].time!.getTime()
                  )
                : undefined;
        point._data = {
            anchor: true,
            zoom: 0,
        };

        const trackIndex = this.temporaryAnchor!.properties.trackIndex;
        const segmentIndex = this.temporaryAnchor!.properties.segmentIndex;
        fileActionManager.applyToFile(this.fileId, (file) =>
            file.replaceTrackPoints(trackIndex, segmentIndex, before + 1, before, [point])
        );

        this.temporaryAnchor = null;
    }

    getDeleteAnchor(anchor: Anchor) {
        return () => this.deleteAnchor(anchor);
    }

    async deleteAnchor(anchor: Anchor) {
        // Remove the anchor and route between the neighbouring anchors if they exist
        this.popup.remove();

        let [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);

        if (previousAnchor === null && nextAnchor === null) {
            // Only one point, remove it
            fileActionManager.applyToFile(this.fileId, (file) =>
                file.replaceTrackPoints(
                    anchor.properties.trackIndex,
                    anchor.properties.segmentIndex,
                    0,
                    0,
                    []
                )
            );
        } else if (previousAnchor === null && nextAnchor !== null) {
            // First point, remove trackpoints until nextAnchor
            fileActionManager.applyToFile(this.fileId, (file) =>
                file.replaceTrackPoints(
                    anchor.properties.trackIndex,
                    anchor.properties.segmentIndex,
                    0,
                    nextAnchor.properties.pointIndex - 1,
                    []
                )
            );
        } else if (nextAnchor === null && previousAnchor !== null) {
            // Last point, remove trackpoints from previousAnchor
            fileActionManager.applyToFile(this.fileId, (file) => {
                const segment = file.getSegment(
                    anchor.properties.trackIndex,
                    anchor.properties.segmentIndex
                );
                file.replaceTrackPoints(
                    anchor.properties.trackIndex,
                    anchor.properties.segmentIndex,
                    previousAnchor.properties.pointIndex + 1,
                    segment.trkpt.length - 1,
                    []
                );
            });
        } else if (previousAnchor !== null && nextAnchor !== null) {
            // Route between previousAnchor and nextAnchor
            const file = get(this.file)?.file;
            if (!file) {
                return;
            }
            const segment = file.getSegment(
                anchor.properties.trackIndex,
                anchor.properties.segmentIndex
            );
            this.routeBetweenAnchors(
                [previousAnchor, nextAnchor],
                [
                    segment.trkpt[previousAnchor.properties.pointIndex],
                    segment.trkpt[nextAnchor.properties.pointIndex],
                ]
            );
        }
    }

    getStartLoopAtAnchor(anchor: Anchor) {
        return () => this.startLoopAtAnchor(anchor);
    }

    startLoopAtAnchor(anchor: Anchor) {
        this.popup.remove();

        const fileWithStats = get(this.file);
        if (!fileWithStats) {
            return;
        }

        const speed = fileWithStats.statistics.getStatisticsFor(
            new ListTrackSegmentItem(
                this.fileId,
                anchor.properties.trackIndex,
                anchor.properties.segmentIndex
            )
        ).global.speed.moving;

        const segment = fileWithStats.file.getSegment(
            anchor.properties.trackIndex,
            anchor.properties.segmentIndex
        );
        fileActionManager.applyToFile(this.fileId, (file) => {
            file.replaceTrackPoints(
                anchor.properties.trackIndex,
                anchor.properties.segmentIndex,
                segment.trkpt.length,
                segment.trkpt.length - 1,
                segment.trkpt.slice(0, anchor.properties.pointIndex),
                speed > 0 ? speed : undefined
            );
            file.crop(
                anchor.properties.pointIndex,
                anchor.properties.pointIndex + segment.trkpt.length - 1,
                [anchor.properties.trackIndex],
                [anchor.properties.segmentIndex]
            );
        });
    }

    async appendAnchor(e: maplibregl.MapMouseEvent) {
        // Add a new anchor to the end of the last segment
        if (get(streetViewEnabled) && get(streetViewSource) === 'google') {
            return;
        }
        if (
            e.target.queryRenderedFeatures(e.point, {
                layers: this.layers
                    .values()
                    .map((layer) => layer.id)
                    .toArray(),
            }).length
        ) {
            // Clicked on routing control, ignoring
            return;
        }
        this.appendAnchorWithCoordinates({
            lat: e.lngLat.lat,
            lon: e.lngLat.lng,
        });
    }

    async appendAnchorWithCoordinates(coordinates: Coordinates) {
        // Add a new anchor to the end of the last segment
        let newAnchorPoint = new TrackPoint({
            attributes: coordinates,
        });

        if (this.anchors.length == 0) {
            this.routeBetweenAnchors(
                [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [
                                newAnchorPoint.getLongitude(),
                                newAnchorPoint.getLatitude(),
                            ],
                        },
                        properties: {
                            trackIndex: 0,
                            segmentIndex: 0,
                            pointIndex: 0,
                            anchorIndex: 0,
                            minZoom: 0,
                        },
                    },
                ],
                [newAnchorPoint]
            );
            return;
        }

        let lastAnchor = this.anchors[this.anchors.length - 1];

        const file = get(this.file)?.file;
        if (!file) {
            return;
        }

        const segment = file.getSegment(
            lastAnchor.properties.trackIndex,
            lastAnchor.properties.segmentIndex
        );
        const lastAnchorPoint = segment.trkpt[lastAnchor.properties.pointIndex];

        let newAnchor: Anchor = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [newAnchorPoint.getLongitude(), newAnchorPoint.getLatitude()],
            },
            properties: {
                trackIndex: lastAnchor.properties.trackIndex,
                segmentIndex: lastAnchor.properties.segmentIndex,
                pointIndex: segment.trkpt.length - 1, // Do as if the point was the last point in the segment
                anchorIndex: 0,
                minZoom: 0,
            },
        };

        await this.routeBetweenAnchors([lastAnchor, newAnchor], [lastAnchorPoint, newAnchorPoint]);
    }

    getNeighbouringAnchors(anchor: Anchor): [Anchor | null, Anchor | null] {
        let previousAnchor: Anchor | null = null;
        let nextAnchor: Anchor | null = null;

        const zoom = get(map)?.getZoom() ?? 20;

        for (let i = 0; i < this.anchors.length; i++) {
            if (
                this.anchors[i].properties.trackIndex === anchor.properties.trackIndex &&
                this.anchors[i].properties.segmentIndex === anchor.properties.segmentIndex &&
                zoom >= this.anchors[i].properties.minZoom
            ) {
                if (this.anchors[i].properties.pointIndex < anchor.properties.pointIndex) {
                    if (
                        !previousAnchor ||
                        this.anchors[i].properties.pointIndex > previousAnchor.properties.pointIndex
                    ) {
                        previousAnchor = this.anchors[i];
                    }
                } else if (this.anchors[i].properties.pointIndex > anchor.properties.pointIndex) {
                    if (
                        !nextAnchor ||
                        this.anchors[i].properties.pointIndex < nextAnchor.properties.pointIndex
                    ) {
                        nextAnchor = this.anchors[i];
                    }
                }
            }
        }

        return [previousAnchor, nextAnchor];
    }

    async routeBetweenAnchors(
        anchors: Anchor[],
        targetTrackPoints: TrackPoint[]
    ): Promise<boolean> {
        const fileWithStats = get(this.file);
        if (!fileWithStats) {
            return false;
        }

        if (anchors.length <= 1) {
            // Only one anchor, update the point in the segment
            targetTrackPoints[0]._data.anchor = true;
            targetTrackPoints[0]._data.zoom = 0;
            let selected = selection.getOrderedSelection();
            if (
                selected.length === 0 ||
                selected[selected.length - 1].getFileId() !== this.fileId
            ) {
                return false;
            }
            let item = selected[selected.length - 1];
            fileActionManager.applyToFile(this.fileId, (file) => {
                let trackIndex = file.trk.length > 0 ? file.trk.length - 1 : 0;
                if (item instanceof ListTrackItem || item instanceof ListTrackSegmentItem) {
                    trackIndex = item.getTrackIndex();
                }
                let segmentIndex =
                    file.trk.length > 0 && file.trk[trackIndex].trkseg.length > 0
                        ? file.trk[trackIndex].trkseg.length - 1
                        : 0;
                if (item instanceof ListTrackSegmentItem) {
                    segmentIndex = item.getSegmentIndex();
                }
                if (file.trk.length === 0) {
                    let track = new Track();
                    track.replaceTrackPoints(0, 0, 0, targetTrackPoints);
                    file.replaceTracks(0, 0, [track]);
                } else if (file.trk[trackIndex].trkseg.length === 0) {
                    let segment = new TrackSegment();
                    segment.replaceTrackPoints(0, 0, targetTrackPoints);
                    file.replaceTrackSegments(trackIndex, 0, 0, [segment]);
                } else {
                    file.replaceTrackPoints(trackIndex, segmentIndex, 0, 0, targetTrackPoints);
                }
            });
            return true;
        }

        let response: TrackPoint[];
        try {
            response = await route(targetTrackPoints.map((trkpt) => trkpt.getCoordinates()));
        } catch (e: any) {
            if (e.message.includes('from-position not mapped in existing datafile')) {
                toast.error(i18n._('toolbar.routing.error.from'));
            } else if (e.message.includes('via1-position not mapped in existing datafile')) {
                toast.error(i18n._('toolbar.routing.error.via'));
            } else if (e.message.includes('to-position not mapped in existing datafile')) {
                toast.error(i18n._('toolbar.routing.error.to'));
            } else if (e.message.includes('Time-out')) {
                toast.error(i18n._('toolbar.routing.error.timeout'));
            } else {
                toast.error(e.message);
            }
            return false;
        }

        const segment = fileWithStats.file.getSegment(
            anchors[0].properties.trackIndex,
            anchors[0].properties.segmentIndex
        );

        if (
            anchors[0].properties.pointIndex !== 0 &&
            (anchors[0].properties.pointIndex !== segment.trkpt.length - 1 ||
                distance(targetTrackPoints[0].getCoordinates(), response[0].getCoordinates()) > 1)
        ) {
            response.splice(0, 0, targetTrackPoints[0].clone()); // Keep the current first anchor
        }

        if (anchors[anchors.length - 1].properties.pointIndex !== segment.trkpt.length - 1) {
            response.push(targetTrackPoints[anchors.length - 1].clone()); // Keep the current last anchor
        }

        let anchorTrackPoints = [response[0], response[response.length - 1]];
        for (let i = 1; i < anchors.length - 1; i++) {
            // Find the closest point to the intermediate anchor, which will become an anchor
            anchorTrackPoints.push(
                getClosestLinePoint(response.slice(1, -1), targetTrackPoints[i])
            );
        }

        anchorTrackPoints.forEach((trkpt) => {
            // Turn them into permanent anchors
            trkpt._data.anchor = true;
            trkpt._data.zoom = 0;
        });

        const stats = fileWithStats.statistics.getStatisticsFor(
            new ListTrackSegmentItem(
                this.fileId,
                anchors[0].properties.trackIndex,
                anchors[0].properties.segmentIndex
            )
        );
        let speed: number | undefined = undefined;
        let startTime = segment.trkpt[anchors[0].properties.pointIndex].time;

        if (stats.global.speed.moving > 0) {
            let replacingDistance = 0;
            for (let i = 1; i < response.length; i++) {
                replacingDistance +=
                    distance(response[i - 1].getCoordinates(), response[i].getCoordinates()) / 1000;
            }
            let startAnchorStats = stats.getTrackPoint(anchors[0].properties.pointIndex)!;
            let endAnchorStats = stats.getTrackPoint(
                anchors[anchors.length - 1].properties.pointIndex
            )!;

            let replacedDistance =
                endAnchorStats.distance.moving - startAnchorStats.distance.moving;

            let newDistance = stats.global.distance.moving + replacingDistance - replacedDistance;
            let newTime = (newDistance / stats.global.speed.moving) * 3600;

            let remainingTime =
                stats.global.time.moving -
                (endAnchorStats.time.moving - startAnchorStats.time.moving);
            let replacingTime = newTime - remainingTime;

            if (replacingTime <= 0) {
                // Fallback to simple time difference
                replacingTime = endAnchorStats.time.total - startAnchorStats.time.total;
            }

            speed = (replacingDistance / replacingTime) * 3600;

            if (startTime === undefined) {
                // Replacing the first point
                let endIndex = anchors[anchors.length - 1].properties.pointIndex;
                startTime = new Date(
                    (segment.trkpt[endIndex].time?.getTime() ?? 0) -
                        (replacingTime + endAnchorStats.time.total - endAnchorStats.time.moving) *
                            1000
                );
            }
        }

        fileActionManager.applyToFile(this.fileId, (file) =>
            file.replaceTrackPoints(
                anchors[0].properties.trackIndex,
                anchors[0].properties.segmentIndex,
                anchors[0].properties.pointIndex,
                anchors[anchors.length - 1].properties.pointIndex,
                response,
                speed,
                startTime
            )
        );

        return true;
    }

    destroy() {
        this.remove();
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    }

    loadIcons() {
        const _map = get(map);
        if (!_map) {
            return;
        }

        loadSVGIcon(
            _map,
            'routing-control',
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" fill="white" stroke="black" stroke-width="2" />
            </svg>`,
            _map.getCanvasContainer().offsetWidth > 1000 ? 50 : 80
        );
    }

    onMouseEnter() {
        mapCursor.notify(MapCursorState.ANCHOR_HOVER, true);
    }

    onMouseLeave() {
        if (this.temporaryAnchor !== null) {
            return;
        }
        mapCursor.notify(MapCursorState.ANCHOR_HOVER, false);
    }

    onClick(e: MapLayerMouseEvent) {
        e.preventDefault();

        if (this.temporaryAnchor !== null) {
            this.turnIntoPermanentAnchor();
            return;
        }

        const anchor = this.anchors[e.features![0].properties.anchorIndex];
        if (e.originalEvent.shiftKey) {
            this.deleteAnchor(anchor);
            return;
        }

        canChangeStart.update(() => {
            if (anchor.properties.pointIndex === 0) {
                return false;
            }
            const segment = get(this.file)?.file.getSegment(
                anchor.properties.trackIndex,
                anchor.properties.segmentIndex
            );
            if (
                !segment ||
                distance(
                    segment.trkpt[0].getCoordinates(),
                    segment.trkpt[segment.trkpt.length - 1].getCoordinates()
                ) > 1000
            ) {
                return false;
            }
            return true;
        });

        this.popup.setLngLat(e.lngLat);
        this.popup.addTo(e.target);

        let deleteThisAnchor = this.getDeleteAnchor(anchor);
        this.popupElement.addEventListener('delete', deleteThisAnchor); // Register the delete event for this anchor
        let startLoopAtThisAnchor = this.getStartLoopAtAnchor(anchor);
        this.popupElement.addEventListener('change-start', startLoopAtThisAnchor); // Register the start loop event for this anchor
        this.popup.once('close', () => {
            this.popupElement.removeEventListener('delete', deleteThisAnchor);
            this.popupElement.removeEventListener('change-start', startLoopAtThisAnchor);
        });
    }

    onMouseDown(e: MapLayerMouseEvent) {
        const _map = get(map);
        if (!_map) {
            return;
        }

        e.preventDefault();
        _map.dragPan.disable();

        this.draggedAnchorIndex = e.features![0].properties.anchorIndex;
        this.draggingStartingPosition = e.point;

        _map.on('mousemove', this.onMouseMoveBinded);
        _map.once('mouseup', this.onMouseUpBinded);
    }

    onTouchStart(e: MapLayerTouchEvent) {
        if (e.points.length !== 1) {
            return;
        }
        const _map = get(map);
        if (!_map) {
            return;
        }

        this.draggedAnchorIndex = e.features![0].properties.anchorIndex;
        this.draggingStartingPosition = e.point;

        e.preventDefault();
        _map.dragPan.disable();

        _map.on('touchmove', this.onMouseMoveBinded);
        _map.once('touchend', this.onMouseUpBinded);
    }

    onMouseMove(e: MapLayerMouseEvent | MapLayerTouchEvent) {
        if (this.draggedAnchorIndex === null || e.point.equals(this.draggingStartingPosition)) {
            return;
        }

        mapCursor.notify(MapCursorState.ANCHOR_DRAGGING, true);

        this.moveAnchorFeature(this.draggedAnchorIndex, {
            lat: e.lngLat.lat,
            lon: e.lngLat.lng,
        });
    }

    onMouseUp(e: MapLayerMouseEvent | MapLayerTouchEvent) {
        mapCursor.notify(MapCursorState.ANCHOR_DRAGGING, false);

        const _map = get(map);
        if (!_map) {
            return;
        }

        _map.dragPan.enable();

        _map.off('mousemove', this.onMouseMoveBinded);
        _map.off('touchmove', this.onMouseMoveBinded);

        if (this.draggedAnchorIndex === null) {
            return;
        }
        if (e.point.equals(this.draggingStartingPosition)) {
            this.draggedAnchorIndex = null;
            return;
        }

        if (this.draggedAnchorIndex === this.anchors.length) {
            if (this.temporaryAnchor) {
                this.moveAnchor(this.temporaryAnchor, {
                    lat: e.lngLat.lat,
                    lon: e.lngLat.lng,
                });
            }
        } else {
            this.moveAnchor(this.anchors[this.draggedAnchorIndex], {
                lat: e.lngLat.lat,
                lon: e.lngLat.lng,
            });
        }

        this.draggedAnchorIndex = null;
    }

    showTemporaryAnchor(e: MapLayerMouseEvent) {
        const map_ = get(map);
        if (!map_) {
            return;
        }

        if (this.draggedAnchorIndex !== null) {
            // Do not not change the source point if it is already being dragged
            return;
        }

        if (get(streetViewEnabled)) {
            return;
        }

        if (
            !get(selection).hasAnyParent(
                new ListTrackSegmentItem(
                    this.fileId,
                    e.features![0].properties.trackIndex,
                    e.features![0].properties.segmentIndex
                )
            )
        ) {
            return;
        }

        if (this.temporaryAnchorCloseToOtherAnchor(e)) {
            return;
        }

        this.temporaryAnchor = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [e.lngLat.lng, e.lngLat.lat],
            },
            properties: {
                trackIndex: e.features![0].properties.trackIndex,
                segmentIndex: e.features![0].properties.segmentIndex,
                pointIndex: 0,
                anchorIndex: this.anchors.length,
                minZoom: 0,
            },
        };

        this.addTemporaryAnchor();
        mapCursor.notify(MapCursorState.ANCHOR_HOVER, true);

        map_.on('mousemove', this.updateTemporaryAnchorBinded);
    }

    updateTemporaryAnchor(e: MapMouseEvent) {
        const map_ = get(map);
        if (!map_ || !this.temporaryAnchor) {
            return;
        }

        if (this.draggedAnchorIndex !== null) {
            // Do not hide if it is being dragged, and stop listening for mousemove
            map_.off('mousemove', this.updateTemporaryAnchorBinded);
            return;
        }

        if (
            e.point.dist(
                map_.project(this.temporaryAnchor.geometry.coordinates as [number, number])
            ) > 20 ||
            this.temporaryAnchorCloseToOtherAnchor(e)
        ) {
            // Hide if too far from the layer
            this.removeTemporaryAnchor();
            return;
        }

        // Update the position of the temporary anchor
        this.moveAnchorFeature(this.anchors.length, {
            lat: e.lngLat.lat,
            lon: e.lngLat.lng,
        });
    }

    temporaryAnchorCloseToOtherAnchor(e: any) {
        const map_ = get(map);
        if (!map_) {
            return false;
        }

        const zoom = map_.getZoom();
        for (let anchor of this.anchors) {
            if (
                zoom >= anchor.properties.minZoom &&
                e.point.dist(map_.project(anchor.geometry.coordinates as [number, number])) < 10
            ) {
                return true;
            }
        }
        return false;
    }

    moveAnchorFeature(anchorIndex: number, coordinates: Coordinates) {
        const anchor =
            anchorIndex === this.anchors.length ? this.temporaryAnchor : this.anchors[anchorIndex];
        let source = get(map)?.getSource(
            this.layers.get(anchor?.properties.minZoom ?? MIN_ANCHOR_ZOOM)?.id ?? ''
        ) as GeoJSONSource | undefined;
        if (source) {
            source.updateData({
                update: [
                    {
                        id: anchorIndex,
                        newGeometry: {
                            type: 'Point',
                            coordinates: [coordinates.lon, coordinates.lat],
                        },
                    },
                ],
            });
        }
    }

    addTemporaryAnchor() {
        if (!this.temporaryAnchor) {
            return;
        }
        let source = get(map)?.getSource('routing-controls-0') as GeoJSONSource | undefined;
        if (source) {
            if (this.temporaryAnchor) {
                source.updateData({
                    add: [this.temporaryAnchor],
                });
            }
        }
    }

    removeTemporaryAnchor() {
        if (!this.temporaryAnchor) {
            return;
        }
        const map_ = get(map);
        let source = map_?.getSource('routing-controls-0') as GeoJSONSource | undefined;
        if (source) {
            if (this.temporaryAnchor) {
                source.updateData({
                    remove: [this.temporaryAnchor.properties.anchorIndex],
                });
            }
        }
        map_?.off('mousemove', this.updateTemporaryAnchorBinded);
        mapCursor.notify(MapCursorState.ANCHOR_HOVER, false);
        this.temporaryAnchor = null;
    }
}

export const routingControls: Map<string, RoutingControls> = new Map();
