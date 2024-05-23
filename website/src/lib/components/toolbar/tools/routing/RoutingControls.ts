import { distance, type Coordinates, TrackPoint, TrackSegment } from "gpx";
import { original } from "immer";
import { get, type Readable } from "svelte/store";
import mapboxgl from "mapbox-gl";
import { route } from "./Routing";

import { toast } from "svelte-sonner";

import { _ } from "svelte-i18n";
import { dbUtils, type GPXFileWithStatistics } from "$lib/db";

export class RoutingControls {
    map: mapboxgl.Map;
    fileId: string = '';
    file: Readable<GPXFileWithStatistics | undefined>;
    anchors: AnchorWithMarker[] = [];
    shownAnchors: AnchorWithMarker[] = [];
    popup: mapboxgl.Popup;
    popupElement: HTMLElement;
    temporaryAnchor: AnchorWithMarker;
    unsubscribe: () => void = () => { };

    toggleAnchorsForZoomLevelAndBoundsBinded: () => void = this.toggleAnchorsForZoomLevelAndBounds.bind(this);
    showTemporaryAnchorBinded: (e: any) => void = this.showTemporaryAnchor.bind(this);
    updateTemporaryAnchorBinded: (e: any) => void = this.updateTemporaryAnchor.bind(this);
    appendAnchorBinded: (e: mapboxgl.MapMouseEvent) => void = this.appendAnchor.bind(this);

    constructor(map: mapboxgl.Map, fileId: string, file: Readable<GPXFileWithStatistics | undefined>, popup: mapboxgl.Popup, popupElement: HTMLElement) {
        this.map = map;
        this.fileId = fileId;
        this.file = file;
        this.popup = popup;
        this.popupElement = popupElement;

        let point = new TrackPoint({
            attributes: {
                lat: 0,
                lon: 0
            }
        });
        this.temporaryAnchor = this.createAnchor(point, new TrackSegment(), 0);
        this.temporaryAnchor.marker.getElement().classList.remove('z-10'); // Show below the other markers

        this.add();
    }

    add() {
        this.map.on('zoom', this.toggleAnchorsForZoomLevelAndBoundsBinded);
        this.map.on('move', this.toggleAnchorsForZoomLevelAndBoundsBinded);
        this.map.on('click', this.appendAnchorBinded);
        this.map.on('mousemove', this.fileId, this.showTemporaryAnchorBinded);

        this.unsubscribe = this.file.subscribe(this.updateControls.bind(this));
    }

    updateControls() { // Update the markers when the file changes
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let segments = file.getSegments();

        let anchorIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            let segment = segments[segmentIndex];

            for (let point of segment.trkpt) { // Update the existing anchors (could be improved by matching the existing anchors with the new ones?)
                if (point._data.anchor) {
                    if (anchorIndex < this.anchors.length) {
                        this.anchors[anchorIndex].point = point;
                        this.anchors[anchorIndex].segment = segment;
                        this.anchors[anchorIndex].marker.setLngLat(point.getCoordinates());
                    } else {
                        this.anchors.push(this.createAnchor(point, segment, segmentIndex));
                    }
                    anchorIndex++;
                }
            }
        }

        while (anchorIndex < this.anchors.length) { // Remove the extra anchors
            this.anchors.pop()?.marker.remove();
        }

        this.toggleAnchorsForZoomLevelAndBounds();
    }

    remove() {
        for (let anchor of this.anchors) {
            anchor.marker.remove();
        }
        this.map.off('zoom', this.toggleAnchorsForZoomLevelAndBoundsBinded);
        this.map.off('move', this.toggleAnchorsForZoomLevelAndBoundsBinded);
        this.map.off('click', this.appendAnchorBinded);
        this.map.off('mousemove', this.fileId, this.showTemporaryAnchorBinded);
        this.map.off('mousemove', this.updateTemporaryAnchorBinded);

        this.unsubscribe();
    }

    createAnchor(point: TrackPoint, segment: TrackSegment, segmentIndex: number): AnchorWithMarker {
        let element = document.createElement('div');
        element.className = `h-3 w-3 rounded-full bg-white border-2 border-black cursor-pointer`;

        let marker = new mapboxgl.Marker({
            draggable: true,
            className: 'z-10',
            element
        }).setLngLat(point.getCoordinates());

        let anchor = {
            point,
            segment,
            segmentIndex,
            marker,
            inZoom: false
        };

        let lastDragEvent = 0;
        marker.on('dragstart', (e) => {
            lastDragEvent = Date.now();
            this.map.getCanvas().style.cursor = 'grabbing';
            element.classList.remove('cursor-pointer');
            element.classList.add('cursor-grabbing');
        });
        marker.on('dragend', (e) => {
            lastDragEvent = Date.now();
            this.map.getCanvas().style.cursor = '';
            element.classList.remove('cursor-grabbing');
            element.classList.add('cursor-pointer');
            this.moveAnchor(anchor);
        });
        marker.getElement().addEventListener('click', (e) => {
            e.stopPropagation();

            if (Date.now() - lastDragEvent < 100) { // Prevent click event during drag
                return;
            }

            if (e.shiftKey) {
                this.deleteAnchor(anchor);
                return;
            }

            marker.setPopup(this.popup);
            marker.togglePopup();

            let deleteThisAnchor = this.getDeleteAnchor(anchor);
            this.popupElement.addEventListener('delete', deleteThisAnchor); // Register the delete event for this anchor
            this.popup.once('close', () => {
                this.popupElement.removeEventListener('delete', deleteThisAnchor);
            });
        });

        return anchor;
    }

    toggleAnchorsForZoomLevelAndBounds() { // Show markers only if they are in the current zoom level and bounds
        this.shownAnchors.splice(0, this.shownAnchors.length);

        let zoom = this.map.getZoom();
        this.anchors.forEach((anchor) => {
            anchor.inZoom = anchor.point._data.zoom <= zoom;
            if (anchor.inZoom && this.map.getBounds().contains(anchor.marker.getLngLat())) {
                anchor.marker.addTo(this.map);
                this.shownAnchors.push(anchor);
            } else {
                anchor.marker.remove();
            }
        });
    }

    showTemporaryAnchor(e: any) {
        if (this.temporaryAnchorCloseToOtherAnchor(e)) {
            return;
        }

        this.temporaryAnchor.point.setCoordinates({
            lat: e.lngLat.lat,
            lon: e.lngLat.lng
        });
        this.temporaryAnchor.marker.setLngLat(e.lngLat).addTo(this.map);

        this.map.on('mousemove', this.updateTemporaryAnchorBinded);
    }

    updateTemporaryAnchor(e: any) {
        if (this.temporaryAnchor.marker.getElement().classList.contains('cursor-grabbing')) { // Do not hide if it is being dragged, and stop listening for mousemove
            this.map.off('mousemove', this.updateTemporaryAnchorBinded);
            return;
        }

        if (e.point.dist(this.map.project(this.temporaryAnchor.point.getCoordinates())) > 20 || this.temporaryAnchorCloseToOtherAnchor(e)) { // Hide if too far from the layer
            this.temporaryAnchor.marker.remove();
            this.map.off('mousemove', this.updateTemporaryAnchorBinded);
            return;
        }

        this.temporaryAnchor.marker.setLngLat(e.lngLat); // Update the position of the temporary anchor
    }

    temporaryAnchorCloseToOtherAnchor(e: any) {
        for (let anchor of this.shownAnchors) {
            if (e.point.dist(this.map.project(anchor.marker.getLngLat())) < 10) {
                return true;
            }
        }
        return false;
    }

    async moveAnchor(anchorWithMarker: AnchorWithMarker) { // Move the anchor and update the route from and to the neighbouring anchors
        let coordinates = {
            lat: anchorWithMarker.marker.getLngLat().lat,
            lon: anchorWithMarker.marker.getLngLat().lng
        };

        let anchor = anchorWithMarker as Anchor;
        if (anchorWithMarker === this.temporaryAnchor) { // Temporary anchor, need to find the closest point of the segment and create an anchor for it
            this.temporaryAnchor.marker.remove();
            anchor = this.getPermanentAnchor();
        }

        let [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);

        let anchors = [];
        let targetCoordinates = [];

        if (previousAnchor !== null) {
            anchors.push(previousAnchor);
            targetCoordinates.push(previousAnchor.point.getCoordinates());
        }

        anchors.push(anchor);
        targetCoordinates.push(coordinates);

        if (nextAnchor !== null) {
            anchors.push(nextAnchor);
            targetCoordinates.push(nextAnchor.point.getCoordinates());
        }

        let success = await this.routeBetweenAnchors(anchors, targetCoordinates);

        if (!success) { // Route failed, revert the anchor to the previous position
            anchorWithMarker.marker.setLngLat(anchorWithMarker.point.getCoordinates());
        }
    }

    getPermanentAnchor(): Anchor {
        let file = get(this.file)?.file;

        // Find the closest point closest to the temporary anchor
        let segments = file.getSegments();
        let minDistance = Number.MAX_VALUE;
        let minAnchor = this.temporaryAnchor as Anchor;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            let segment = segments[segmentIndex];
            for (let point of segment.trkpt) {
                let dist = distance(point.getCoordinates(), this.temporaryAnchor.point.getCoordinates());
                if (dist < minDistance) {
                    minDistance = dist;
                    minAnchor = {
                        point,
                        segment,
                        segmentIndex,
                    };
                }
            }
        }

        return minAnchor;
    }

    getDeleteAnchor(anchor: Anchor) {
        return () => this.deleteAnchor(anchor);
    }

    async deleteAnchor(anchor: Anchor) { // Remove the anchor and route between the neighbouring anchors if they exist
        this.popup.remove();

        let [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);

        if (previousAnchor === null && nextAnchor === null) { // Only one point, remove it
            dbUtils.applyToFile(this.fileId, (file) => file.replace(anchor.segmentIndex, 0, 0, []));
        } else if (previousAnchor === null) { // First point, remove trackpoints until nextAnchor
            dbUtils.applyToFile(this.fileId, (file) => file.replace(anchor.segmentIndex, 0, nextAnchor.point._data.index - 1, []));
        } else if (nextAnchor === null) { // Last point, remove trackpoints from previousAnchor
            dbUtils.applyToFile(this.fileId, (file) => {
                let segment = file.getSegments()[anchor.segmentIndex];
                return file.replace(anchor.segmentIndex, previousAnchor.point._data.index + 1, segment.trkpt.length - 1, []);
            });
        } else { // Route between previousAnchor and nextAnchor
            this.routeBetweenAnchors([previousAnchor, nextAnchor], [previousAnchor.point.getCoordinates(), nextAnchor.point.getCoordinates()]);
        }
    }

    async appendAnchor(e: mapboxgl.MapMouseEvent) { // Add a new anchor to the end of the last segment
        this.appendAnchorWithCoordinates({
            lat: e.lngLat.lat,
            lon: e.lngLat.lng
        });
    }

    async appendAnchorWithCoordinates(coordinates: Coordinates) { // Add a new anchor to the end of the last segment
        let lastAnchor = this.anchors[this.anchors.length - 1];

        let newPoint = new TrackPoint({
            attributes: coordinates
        });
        newPoint._data.anchor = true;
        newPoint._data.zoom = 0;

        if (!lastAnchor) {
            // TODO, create segment if it does not exist
            dbUtils.applyToFile(this.fileId, (file) => file.replace(0, 0, 0, [newPoint]));
            return;
        }

        newPoint._data.index = lastAnchor.segment.trkpt.length - 1; // Do as if the point was the last point in the segment
        let newAnchor = {
            point: newPoint,
            segment: lastAnchor.segment,
            segmentIndex: lastAnchor.segmentIndex
        };

        await this.routeBetweenAnchors([lastAnchor, newAnchor], [lastAnchor.point.getCoordinates(), newAnchor.point.getCoordinates()]);
    }

    routeToStart() {
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let segments = file.getSegments();
        if (segments.length === 0) {
            return;
        }

        let segment = segments[segments.length - 1];
        let firstAnchor = this.anchors.find((anchor) => anchor.segment === segment);

        if (!firstAnchor) {
            return;
        }

        this.appendAnchorWithCoordinates(firstAnchor.point.getCoordinates());
    }

    createRoundTrip() {
        let file = get(this.file)?.file;
        if (!file) {
            return;
        }

        let segments = file.getSegments();
        if (segments.length === 0) {
            return;
        }

        dbUtils.applyToFile(this.fileId, (file) => {
            let segment = original(file).getSegments()[segments.length - 1];
            let newSegment = segment.clone();
            newSegment = newSegment.reverse(segment.getEndTimestamp(), segment.getEndTimestamp());
            return file.replace(segments.length - 1, segment.trkpt.length, segment.trkpt.length, newSegment.trkpt.map((point) => point));
        });
    }

    getNeighbouringAnchors(anchor: Anchor): [Anchor | null, Anchor | null] {
        let previousAnchor: Anchor | null = null;
        let nextAnchor: Anchor | null = null;

        for (let i = 0; i < this.anchors.length; i++) {
            if (this.anchors[i].segment === anchor.segment && this.anchors[i].inZoom) {
                if (this.anchors[i].point._data.index < anchor.point._data.index) {
                    if (!previousAnchor || this.anchors[i].point._data.index > previousAnchor.point._data.index) {
                        previousAnchor = this.anchors[i];
                    }
                } else if (this.anchors[i].point._data.index > anchor.point._data.index) {
                    if (!nextAnchor || this.anchors[i].point._data.index < nextAnchor.point._data.index) {
                        nextAnchor = this.anchors[i];
                    }
                }
            }
        }

        return [previousAnchor, nextAnchor];
    }

    async routeBetweenAnchors(anchors: Anchor[], targetCoordinates: Coordinates[]): Promise<boolean> {
        let segment = anchors[0].segment;

        if (anchors.length === 1) { // Only one anchor, update the point in the segment
            dbUtils.applyToFile(this.fileId, (file) => file.replace(anchors[0].segmentIndex, 0, 0, [new TrackPoint({
                attributes: targetCoordinates[0],
            })]));
            return true;
        }

        let response: TrackPoint[];
        try {
            response = await route(targetCoordinates);
        } catch (e: any) {
            if (e.message.includes('from-position not mapped in existing datafile')) {
                toast.error(get(_)("toolbar.routing.error.from"));
            } else if (e.message.includes('via1-position not mapped in existing datafile')) {
                toast.error(get(_)("toolbar.routing.error.via"));
            } else if (e.message.includes('to-position not mapped in existing datafile')) {
                toast.error(get(_)("toolbar.routing.error.to"));
            } else if (e.message.includes('Time-out')) {
                toast.error(get(_)("toolbar.routing.error.timeout"));
            } else {
                toast.error(e.message);
            }
            return false;
        }

        if (anchors[0].point._data.index === 0) { // First anchor is the first point of the segment
            anchors[0].point = response[0]; // Replace the first anchor
            anchors[0].point._data.index = 0;
        } else {
            anchors[0].point = anchors[0].point.clone(); // Clone the anchor to assign new properties
            response.splice(0, 0, anchors[0].point); // Insert it in the response to keep it
        }

        if (anchors[anchors.length - 1].point._data.index === segment.trkpt.length - 1) { // Last anchor is the last point of the segment
            anchors[anchors.length - 1].point = response[response.length - 1]; // Replace the last anchor
            anchors[anchors.length - 1].point._data.index = segment.trkpt.length - 1;
        } else {
            anchors[anchors.length - 1].point = anchors[anchors.length - 1].point.clone(); // Clone the anchor to assign new properties
            response.push(anchors[anchors.length - 1].point); // Insert it in the response to keep it
        }

        for (let i = 1; i < anchors.length - 1; i++) {
            // Find the closest point to the intermediate anchor
            // and transfer the marker to that point
            let minDistance = Number.MAX_VALUE;
            let minIndex = 0;
            for (let j = 1; j < response.length - 1; j++) {
                let dist = distance(response[j].getCoordinates(), targetCoordinates[i]);
                if (dist < minDistance) {
                    minDistance = dist;
                    minIndex = j;
                }
            }
            anchors[i].point = response[minIndex];
        }

        anchors.forEach((anchor) => {
            anchor.point._data.anchor = true;
            anchor.point._data.zoom = 0; // Make these anchors permanent
        });

        dbUtils.applyToFile(this.fileId, (file) => file.replace(anchors[0].segmentIndex, anchors[0].point._data.index, anchors[anchors.length - 1].point._data.index, response));

        return true;
    }
}

type Anchor = {
    segment: TrackSegment;
    segmentIndex: number;
    point: TrackPoint;
};

type AnchorWithMarker = Anchor & {
    marker: mapboxgl.Marker;
    inZoom: boolean;
};
