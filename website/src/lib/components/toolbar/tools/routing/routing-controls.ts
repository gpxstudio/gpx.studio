import { distance, type Coordinates } from '$lib/geo';
import { get, writable } from 'svelte/store';
import maplibregl, {
    type MapMouseEvent,
    type GeoJSONSource,
    type MapLayerMouseEvent,
    type MapLayerTouchEvent,
} from 'maplibre-gl';
import { route } from './routing';
import { toast } from 'svelte-sonner';
import { loadSVGIcon } from '$lib/utils';
import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { streetViewEnabled } from '$lib/components/map/street-view-control/utils';
import { i18n } from '$lib/i18n.svelte';
import { map } from '$lib/components/map/map';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import { settings } from '$lib/logic/settings';
import { closestPointIndexIn } from '$lib/closest-point';
import {
    engine,
    type Selection,
    type SelectionAnchors,
    type SelectionStatistics,
    type StatisticsRequest,
} from '$lib/engine';

const { streetViewSource } = settings;

/** Whether the popup of an anchor can offer to start the loop there. */
export const canChangeStart = writable(false);

const MIN_ANCHOR_ZOOM = 0;
const MAX_ANCHOR_ZOOM = 22;

/** An anchor of a segment of the selection, a trackpoint that can be dragged to reroute it. */
type Anchor = {
    /** Position among the anchors of the selection, which identifies its feature on the map. */
    id: number;
    /** Index of the trackpoint in the selection. */
    index: number;
    /** Position among the segments of the selection. */
    segment: number;
    /** Lowest map zoom level at which the anchor is shown. */
    zoom: number;
    lng: number;
    lat: number;
};

type AnchorProperties = { anchorIndex: number; minZoom: number };
type AnchorFeature = GeoJSON.Feature<GeoJSON.Point, AnchorProperties>;

/** Whether the tool has to show controls for a selection: it covers segments, or can get some. */
function isRoutable(selection: Selection) {
    return selection.type === 'file' || selection.type === 'track' || selection.type === 'segment';
}

/**
 * The anchors of the selection of the engine, shown on the map where the user can drag them to
 * reroute the segments, or click on the segments to add some. Every interaction is turned into a
 * command of the engine, which finds the files and segments by the indices of the trackpoints in
 * the selection.
 */
export class RoutingControls {
    active = false;
    layers: Map<number, { id: string; features: AnchorFeature[] }> = new Map();
    anchors: Anchor[] = [];
    statistics: SelectionStatistics | undefined = undefined;
    /** What the tool needs from the engine, while it shows the anchors. */
    request: StatisticsRequest = engine.requestStatistics();
    selection: Selection = { type: 'empty' };
    /** Ids of the files whose line layer is listened to. */
    listenedFileIds: string[] = [];
    popup: maplibregl.Popup;
    popupElement: HTMLElement;
    unsubscribes: Function[] = [];

    updateBinded: () => void = this.update.bind(this);
    appendAnchorBinded: (e: MapMouseEvent) => void = this.appendAnchor.bind(this);
    addIntermediateAnchorBinded: (e: MapMouseEvent) => void = this.addIntermediateAnchor.bind(this);

    /** Id of the anchor that is dragged: `anchors.length` for the temporary anchor. */
    draggedAnchorId: number | null = null;
    lastDraggedAnchorEventTime = 0;
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

    /**
     * Where the pointer hovers a segment of the selection: an anchor that can be dragged or
     * clicked to be added.
     */
    temporaryAnchor: (Coordinates & { segment: number }) | null = null;
    showTemporaryAnchorBinded: (e: MapLayerMouseEvent) => void =
        this.showTemporaryAnchor.bind(this);
    updateTemporaryAnchorBinded: (e: MapMouseEvent) => void = this.updateTemporaryAnchor.bind(this);

    constructor(popup: maplibregl.Popup, popupElement: HTMLElement) {
        for (let zoom = MIN_ANCHOR_ZOOM; zoom <= MAX_ANCHOR_ZOOM; zoom++) {
            this.layers.set(zoom, { id: `routing-controls-${zoom}`, features: [] });
        }
        this.popup = popup;
        this.popupElement = popupElement;

        this.unsubscribes.push(engine.selection.subscribe(this.onSelection.bind(this)));
        this.unsubscribes.push(currentTool.subscribe(this.updateBinded));
        this.unsubscribes.push(engine.statistics.subscribe(this.onStatistics.bind(this)));
        this.unsubscribes.push(engine.files.subscribe(this.updateFileListeners.bind(this)));
    }

    onSelection(selection: Selection) {
        this.selection = selection;
        this.update();
    }

    onStatistics(statistics: SelectionStatistics) {
        this.statistics = statistics;
        this.update();
    }

    get anchorData(): SelectionAnchors | undefined {
        return this.statistics?.anchors;
    }

    update() {
        const routing = get(currentTool) === Tool.ROUTING && isRoutable(this.selection);
        this.request.set(routing ? ['anchors'] : []);
        if (!routing) {
            if (this.active) {
                this.remove();
            }
            return;
        }
        if (!this.active) {
            this.add();
        }
        this.updateControls();
    }

    add() {
        const map_ = get(map);
        const layerEventManager = map.layerEventManager;
        if (!map_ || !layerEventManager) {
            return;
        }

        this.active = true;

        this.loadIcons();

        map_.on('style.load', this.updateBinded);
        map_.on('click', this.appendAnchorBinded);
        this.updateFileListeners();
    }

    /** Listens to the lines of the files, to add anchors where the pointer hovers a segment. */
    updateFileListeners() {
        const layerEventManager = map.layerEventManager;
        if (!layerEventManager) {
            return;
        }
        const fileIds = this.active ? [...get(engine.files).keys()] : [];
        for (const fileId of this.listenedFileIds) {
            if (!fileIds.includes(fileId)) {
                layerEventManager.off('mousemove', fileId, this.showTemporaryAnchorBinded);
                layerEventManager.off('click', fileId, this.addIntermediateAnchorBinded);
            }
        }
        for (const fileId of fileIds) {
            if (!this.listenedFileIds.includes(fileId)) {
                layerEventManager.on('mousemove', fileId, this.showTemporaryAnchorBinded);
                layerEventManager.on('click', fileId, this.addIntermediateAnchorBinded);
            }
        }
        this.listenedFileIds = fileIds;
    }

    /** The anchors of the selection, from the statistics of the engine. */
    readAnchors(): Anchor[] {
        const statistics = this.statistics;
        const data = this.anchorData;
        if (!statistics || !data) {
            return [];
        }
        const anchors: Anchor[] = [];
        let segment = 0;
        for (let id = 0; id < data.indices.length; id++) {
            const index = data.indices[id];
            // the anchors are sorted: the segment can only be the same or a following one
            while (
                segment + 1 < data.segmentStarts.length &&
                data.segmentStarts[segment + 1] <= index
            ) {
                segment++;
            }
            anchors.push({
                id,
                index,
                segment,
                zoom: data.zooms[id],
                lng: statistics.lng[index],
                lat: statistics.lat[index],
            });
        }
        return anchors;
    }

    /** First trackpoint of a segment of the selection, and the one after its last one. */
    segmentRange(segment: number): [number, number] {
        const starts = this.anchorData?.segmentStarts;
        const length = this.statistics?.length ?? 0;
        if (!starts) {
            return [0, 0];
        }
        return [starts[segment], segment + 1 < starts.length ? starts[segment + 1] : length];
    }

    updateControls() {
        const map_ = get(map);
        const layerEventManager = map.layerEventManager;
        if (!map_ || !layerEventManager || !this.active) {
            return;
        }

        this.layers.forEach((layer) => (layer.features = []));
        this.anchors = this.readAnchors();
        for (const anchor of this.anchors) {
            this.layers.get(anchor.zoom)?.features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [anchor.lng, anchor.lat] },
                properties: { anchorIndex: anchor.id, minZoom: anchor.zoom },
            });
        }
        // the anchors have changed, so has what is hovered
        this.temporaryAnchor = null;

        this.layers.forEach((layer, zoom) => {
            try {
                const source = map_.getSource(layer.id) as maplibregl.GeoJSONSource | undefined;
                const data: GeoJSON.FeatureCollection = {
                    type: 'FeatureCollection',
                    features: layer.features,
                };
                if (source) {
                    source.setData(data);
                } else {
                    map_.addSource(layer.id, { type: 'geojson', data, promoteId: 'anchorIndex' });
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
        this.anchors = [];
        this.temporaryAnchor = null;

        map_?.off('style.load', this.updateBinded);
        map_?.off('click', this.appendAnchorBinded);
        map_?.off('mousemove', this.updateTemporaryAnchorBinded);
        this.updateFileListeners();

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
    }

    position(index: number): Coordinates {
        return { lng: this.statistics!.lng[index], lat: this.statistics!.lat[index] };
    }

    async moveAnchor(anchor: Anchor, coordinates: Coordinates) {
        // Move the anchor and update the route from and to the neighbouring anchors
        const initialAnchor = anchor;
        const initialCoordinates = { lng: anchor.lng, lat: anchor.lat };
        if (anchor.id === this.anchors.length) {
            // Temporary anchor, need to find the closest point of the segment and create an anchor for it
            const permanent = this.getPermanentAnchor();
            this.removeTemporaryAnchor();
            if (!permanent) {
                return;
            }
            anchor = permanent;
        }

        const [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);

        const chain: Anchor[] = [];
        const targets: Coordinates[] = [];
        if (previousAnchor) {
            chain.push(previousAnchor);
            targets.push(this.position(previousAnchor.index));
        }
        chain.push(anchor);
        targets.push(coordinates);
        if (nextAnchor) {
            chain.push(nextAnchor);
            targets.push(this.position(nextAnchor.index));
        }

        const success = await this.routeBetweenAnchors(chain, targets);

        if (!success && initialAnchor.id !== this.anchors.length) {
            // Route failed, revert the anchor to the previous position
            this.moveAnchorFeature(initialAnchor, initialCoordinates);
        }
    }

    /** The trackpoint of the hovered segment that is the closest to the temporary anchor. */
    getPermanentAnchor(): Anchor | undefined {
        const temporary = this.temporaryAnchor;
        const statistics = this.statistics;
        if (!temporary || !statistics) {
            return undefined;
        }
        const [start, end] = this.segmentRange(temporary.segment);
        const index = closestPointIndexIn(statistics.lng, statistics.lat, start, end, temporary);
        if (index === undefined) {
            return undefined;
        }
        return {
            id: this.anchors.length,
            index,
            segment: temporary.segment,
            zoom: 0,
            ...this.position(index),
        };
    }

    /** Makes an anchor of the hovered point of a segment. */
    turnIntoPermanentAnchor() {
        const temporary = this.temporaryAnchor;
        const revision = this.anchorData?.revision;
        if (!temporary || revision === undefined) {
            return;
        }
        engine.insertAnchor(revision, temporary.lng, temporary.lat);
        this.removeTemporaryAnchor();
    }

    getDeleteAnchor(anchor: Anchor) {
        return () => this.deleteAnchor(anchor);
    }

    async deleteAnchor(anchor: Anchor) {
        // Remove the anchor and route between the neighbouring anchors if they exist
        this.popup.remove();

        const revision = this.anchorData?.revision;
        if (revision === undefined) {
            return;
        }
        const [segmentStart, segmentEnd] = this.segmentRange(anchor.segment);
        const [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);
        const noPoints = { lng: [], lat: [], ele: [] };

        if (previousAnchor === null && nextAnchor === null) {
            // Only one point, remove it
            engine.route(revision, anchor.index, anchor.index + 1, noPoints);
        } else if (previousAnchor === null && nextAnchor !== null) {
            // First point, remove trackpoints until nextAnchor
            engine.route(revision, segmentStart, nextAnchor.index, noPoints);
        } else if (nextAnchor === null && previousAnchor !== null) {
            // Last point, remove trackpoints from previousAnchor
            engine.route(revision, previousAnchor.index + 1, segmentEnd, noPoints);
        } else if (previousAnchor !== null && nextAnchor !== null) {
            // Route between previousAnchor and nextAnchor
            this.routeBetweenAnchors(
                [previousAnchor, nextAnchor],
                [this.position(previousAnchor.index), this.position(nextAnchor.index)]
            );
        }
    }

    getStartLoopAtAnchor(anchor: Anchor) {
        return () => this.startLoopAtAnchor(anchor);
    }

    startLoopAtAnchor(anchor: Anchor) {
        this.popup.remove();

        const revision = this.anchorData?.revision;
        if (revision !== undefined) {
            engine.changeLoopStart(revision, anchor.index);
        }
    }

    /** Whether the segment of the anchor is a loop that can start at the anchor. */
    canStartLoopAt(anchor: Anchor): boolean {
        const [start, end] = this.segmentRange(anchor.segment);
        if (!this.statistics || anchor.index === start || end <= start) {
            return false;
        }
        const first = this.position(start);
        const last = this.position(end - 1);
        // the end of the segment has to be close to its start, up to a kilometer
        return distance(first, last) <= 1000;
    }

    async appendAnchor(e: maplibregl.MapMouseEvent) {
        // Add a new anchor to the end of the last segment
        if (get(streetViewEnabled) && get(streetViewSource) === 'google') {
            return;
        }
        if (this.draggedAnchorId !== null || Date.now() - this.lastDraggedAnchorEventTime < 100) {
            // Exit if anchor is being dragged
            return;
        }
        if (
            e.target.queryRenderedFeatures(e.point, {
                layers: [...this.listenedFileIds, ...[...this.layers.values()].map((l) => l.id)],
            }).length
        ) {
            // Clicked on routing control or layer, ignoring
            return;
        }
        this.appendAnchorWithCoordinates({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    }

    async appendAnchorWithCoordinates(coordinates: Coordinates) {
        // Add a new anchor to the end of the last segment
        const statistics = this.statistics;
        const revision = this.anchorData?.revision;
        if (!statistics || revision === undefined) {
            return;
        }

        if (this.anchors.length === 0) {
            // Nothing in the selection yet: the first trackpoint, in a new segment if needed
            engine.route(
                revision,
                0,
                0,
                { lng: [coordinates.lng], lat: [coordinates.lat], ele: [0] },
                [0]
            );
            return;
        }

        // Route from the last trackpoint (an anchor), as if the new anchor was also the last one
        const last = this.anchors[this.anchors.length - 1];
        const lastIndex = statistics.length - 1;
        await this.routeBetweenAnchors(
            [last, { ...last, id: 0, index: lastIndex }],
            [this.position(last.index), coordinates]
        );
    }

    addIntermediateAnchor(e: maplibregl.MapMouseEvent) {
        e.preventDefault();

        if (this.temporaryAnchor !== null) {
            this.turnIntoPermanentAnchor();
            return;
        }
    }

    getNeighbouringAnchors(anchor: Anchor): [Anchor | null, Anchor | null] {
        let previousAnchor: Anchor | null = null;
        let nextAnchor: Anchor | null = null;

        const zoom = get(map)?.getZoom() ?? 20;

        for (const other of this.anchors) {
            if (other.segment === anchor.segment && zoom >= other.zoom) {
                if (other.index < anchor.index) {
                    if (!previousAnchor || other.index > previousAnchor.index) {
                        previousAnchor = other;
                    }
                } else if (other.index > anchor.index) {
                    if (!nextAnchor || other.index < nextAnchor.index) {
                        nextAnchor = other;
                    }
                }
            }
        }

        return [previousAnchor, nextAnchor];
    }

    /**
     * Routes through the positions `targets`, which are the ones of the anchors `anchors` (in a
     * single segment) or where they were moved to, and replaces what is between the first and
     * the last anchor by the route.
     */
    async routeBetweenAnchors(anchors: Anchor[], targets: Coordinates[]): Promise<boolean> {
        const revision = this.anchorData?.revision;
        if (revision === undefined) {
            return false;
        }

        if (anchors.length <= 1) {
            // Only one anchor: it moves
            return engine.route(
                revision,
                anchors[0].index,
                anchors[0].index + 1,
                { lng: [targets[0].lng], lat: [targets[0].lat], ele: [0] },
                [0]
            );
        }

        let response;
        try {
            response = await route(targets);
        } catch (e: any) {
            toast.error(i18n._(e.message, e.message));
            return false;
        }

        const first = anchors[0];
        const last = anchors[anchors.length - 1];
        const [segmentStart, segmentEnd] = this.segmentRange(first.segment);
        const lastIndex = segmentEnd - 1;

        // The anchors at the ends are kept as they are, except if they are the ends of the
        // segment: then the route goes in their place.
        const keepFirst =
            first.index !== segmentStart &&
            (first.index !== lastIndex ||
                distance(targets[0], {
                    lat: response.lat[0],
                    lng: response.lng[0],
                }) > 1);
        const keepLast = last.index !== lastIndex;

        const start = keepFirst ? first.index + 1 : first.index;
        const end = keepLast ? last.index : last.index + 1;

        // Anchors among the new points: the ends that are not kept, and the point of the route
        // that is the closest to each intermediate anchor.
        const newAnchors: number[] = [];
        if (!keepFirst) {
            newAnchors.push(0);
        }
        if (!keepLast) {
            newAnchors.push(response.lng.length - 1);
        }
        for (let i = 1; i < anchors.length - 1; i++) {
            const closest = closestPointIndexIn(
                response.lng,
                response.lat,
                1,
                response.lng.length - 1,
                targets[i]
            );
            if (closest !== undefined) {
                newAnchors.push(closest);
            }
        }

        return engine.route(revision, start, end, response, newAnchors);
    }

    destroy() {
        this.remove();
        this.request.release();
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
            _map.getCanvasContainer().offsetWidth > 1000 ? 56 : 80
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

        if (this.draggedAnchorId !== null || Date.now() - this.lastDraggedAnchorEventTime < 100) {
            // Exit if anchor is being dragged
            return;
        }

        const anchor = this.anchors[e.features![0].properties.anchorIndex];
        if (!anchor) {
            return;
        }
        if (e.originalEvent.shiftKey) {
            this.deleteAnchor(anchor);
            return;
        }

        canChangeStart.set(this.canStartLoopAt(anchor));

        this.popup.setLngLat(e.lngLat);
        this.popup.addTo(e.target);

        const deleteThisAnchor = this.getDeleteAnchor(anchor);
        this.popupElement.addEventListener('delete', deleteThisAnchor); // Register the delete event for this anchor
        const startLoopAtThisAnchor = this.getStartLoopAtAnchor(anchor);
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

        this.draggedAnchorId = e.features![0].properties.anchorIndex;
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

        this.draggedAnchorId = e.features![0].properties.anchorIndex;
        this.draggingStartingPosition = e.point;

        e.preventDefault();
        _map.dragPan.disable();

        _map.on('touchmove', this.onMouseMoveBinded);
        _map.once('touchend', this.onMouseUpBinded);
    }

    /** The anchor with this id, which is the temporary one if it is `anchors.length`. */
    anchorWithId(id: number): Anchor | undefined {
        if (id === this.anchors.length && this.temporaryAnchor) {
            return { id, index: 0, zoom: 0, ...this.temporaryAnchor };
        }
        return this.anchors[id];
    }

    onMouseMove(e: MapLayerMouseEvent | MapLayerTouchEvent) {
        if (this.draggedAnchorId === null || e.point.equals(this.draggingStartingPosition)) {
            return;
        }

        mapCursor.notify(MapCursorState.ANCHOR_DRAGGING, true);

        const anchor = this.anchorWithId(this.draggedAnchorId);
        if (anchor) {
            this.moveAnchorFeature(anchor, { lng: e.lngLat.lng, lat: e.lngLat.lat });
        }

        this.lastDraggedAnchorEventTime = Date.now();
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

        if (this.draggedAnchorId === null) {
            return;
        }
        if (e.point.equals(this.draggingStartingPosition)) {
            this.draggedAnchorId = null;
            return;
        }

        const anchor = this.anchorWithId(this.draggedAnchorId);
        if (anchor) {
            this.moveAnchor(anchor, { lng: e.lngLat.lng, lat: e.lngLat.lat });
        }

        this.draggedAnchorId = null;
        this.lastDraggedAnchorEventTime = Date.now();
    }

    showTemporaryAnchor(e: MapLayerMouseEvent) {
        const map_ = get(map);
        const segmentIds = this.anchorData?.segmentIds;
        if (!map_ || !segmentIds) {
            return;
        }

        if (this.draggedAnchorId !== null) {
            // Do not not change the source point if it is already being dragged
            return;
        }

        if (get(streetViewEnabled)) {
            return;
        }

        // only the segments of the selection
        const segment = segmentIds.indexOf(e.features![0].properties.segmentId);
        if (segment < 0) {
            return;
        }

        if (this.temporaryAnchorCloseToOtherAnchor(e)) {
            return;
        }

        this.temporaryAnchor = { lng: e.lngLat.lng, lat: e.lngLat.lat, segment };

        this.addTemporaryAnchor();
        mapCursor.notify(MapCursorState.ANCHOR_HOVER, true);

        map_.on('mousemove', this.updateTemporaryAnchorBinded);
    }

    updateTemporaryAnchor(e: MapMouseEvent) {
        const map_ = get(map);
        if (!map_ || !this.temporaryAnchor) {
            return;
        }

        if (this.draggedAnchorId !== null) {
            // Do not hide if it is being dragged, and stop listening for mousemove
            map_.off('mousemove', this.updateTemporaryAnchorBinded);
            return;
        }

        if (
            e.point.dist(map_.project([this.temporaryAnchor.lng, this.temporaryAnchor.lat])) > 20 ||
            this.temporaryAnchorCloseToOtherAnchor(e)
        ) {
            // Hide if too far from the layer
            this.removeTemporaryAnchor();
            return;
        }

        // Update the position of the temporary anchor
        const position = { lng: e.lngLat.lng, lat: e.lngLat.lat };
        this.moveAnchorFeature(this.anchorWithId(this.anchors.length)!, position);
    }

    temporaryAnchorCloseToOtherAnchor(e: any) {
        const map_ = get(map);
        if (!map_) {
            return false;
        }

        const zoom = map_.getZoom();
        for (const anchor of this.anchors) {
            if (zoom >= anchor.zoom && e.point.dist(map_.project([anchor.lng, anchor.lat])) < 10) {
                return true;
            }
        }
        return false;
    }

    moveAnchorFeature(anchor: Anchor, coordinates: Coordinates) {
        const source = get(map)?.getSource(
            this.layers.get(anchor.id === this.anchors.length ? 0 : anchor.zoom)?.id ?? ''
        ) as GeoJSONSource | undefined;
        if (source) {
            source.updateData({
                update: [
                    {
                        id: anchor.id,
                        newGeometry: {
                            type: 'Point',
                            coordinates: [coordinates.lng, coordinates.lat],
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
        const source = get(map)?.getSource(this.layers.get(0)!.id) as GeoJSONSource | undefined;
        source?.updateData({
            add: [
                {
                    type: 'Feature',
                    id: this.anchors.length,
                    geometry: {
                        type: 'Point',
                        coordinates: [this.temporaryAnchor.lng, this.temporaryAnchor.lat],
                    },
                    properties: { anchorIndex: this.anchors.length, minZoom: 0 },
                },
            ],
        });
    }

    removeTemporaryAnchor() {
        if (!this.temporaryAnchor) {
            return;
        }
        const map_ = get(map);
        const source = map_?.getSource(this.layers.get(0)!.id) as GeoJSONSource | undefined;
        source?.updateData({ remove: [this.anchors.length] });
        map_?.off('mousemove', this.updateTemporaryAnchorBinded);
        mapCursor.notify(MapCursorState.ANCHOR_HOVER, false);
        this.temporaryAnchor = null;
    }
}
