import { distance, type Coordinates, type GPXFile, type TrackSegment, TrackPoint } from "gpx";
import { get, type Writable } from "svelte/store";
import { computeAnchorPoints, type SimplifiedTrackPoint } from "./Simplify";
import mapboxgl from "mapbox-gl";
import { route } from "./Routing";
import { applyToFileElement } from "$lib/stores";

import { toast } from "svelte-sonner";

import { _ } from "svelte-i18n";

export class RoutingControls {
    map: mapboxgl.Map;
    file: Writable<GPXFile>;
    markers: mapboxgl.Marker[] = [];
    shownMarkers: mapboxgl.Marker[] = [];
    popup: mapboxgl.Popup;
    popupElement: HTMLElement;
    temporaryAnchor: SimplifiedTrackPoint;
    unsubscribe: () => void = () => { };

    toggleMarkersForZoomLevelAndBoundsBinded: () => void = this.toggleMarkersForZoomLevelAndBounds.bind(this);
    showTemporaryAnchorBinded: (e: any) => void = this.showTemporaryAnchor.bind(this);
    hideTemporaryAnchorBinded: (e: any) => void = this.hideTemporaryAnchor.bind(this);
    appendAnchorBinded: (e: mapboxgl.MapMouseEvent) => void = this.appendAnchor.bind(this);

    constructor(map: mapboxgl.Map, file: Writable<GPXFile>, popup: mapboxgl.Popup, popupElement: HTMLElement) {
        this.map = map;
        this.file = file;
        this.popup = popup;
        this.popupElement = popupElement;


        this.temporaryAnchor = {
            point: new TrackPoint({
                attributes: {
                    lon: 0,
                    lat: 0
                }
            }),
            zoom: 0
        };
        this.createMarker(this.temporaryAnchor);
        let marker = this.markers.pop(); // Remove the temporary anchor from the markers list
        marker.getElement().classList.remove('z-10'); // Show below the other markers
        Object.defineProperty(marker, '_temporary', {
            value: true
        });

        this.add();
    }

    add() {
        this.map.on('zoom', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.on('move', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.on('click', this.appendAnchorBinded);
        this.map.on('mousemove', get(this.file)._data.layerId, this.showTemporaryAnchorBinded);

        this.unsubscribe = this.file.subscribe(this.updateControls.bind(this));
    }

    updateControls() { // Update the markers when the file changes
        for (let segment of get(this.file).getSegments()) {
            if (!segment._data.anchors) { // New segment, create anchors for it
                computeAnchorPoints(segment);
                this.createMarkers(segment);
                continue;
            }

            let anchors = segment._data.anchors;
            for (let i = 0; i < anchors.length;) {
                let anchor = anchors[i];
                if (anchor.point._data.index >= segment.trkpt.length || anchor.point !== segment.trkpt[anchor.point._data.index]) { // Point does not exist anymore, remove the anchor
                    anchors.splice(i, 1);
                    this.markers[i].remove();
                    this.markers.splice(i, 1);
                    continue;
                }
                i++;
            }
        }

        this.toggleMarkersForZoomLevelAndBounds();
    }

    remove() {
        for (let marker of this.markers) {
            marker.remove();
        }
        this.map.off('zoom', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.off('move', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.off('click', this.appendAnchorBinded);
        this.map.off('mousemove', get(this.file)._data.layerId, this.showTemporaryAnchorBinded);
        this.map.off('mousemove', this.hideTemporaryAnchorBinded);

        this.unsubscribe();
    }

    createMarkers(segment: TrackSegment) {
        for (let anchor of segment._data.anchors) {
            this.createMarker(anchor);
        }
    }

    createMarker(anchor: SimplifiedTrackPoint) {
        let element = document.createElement('div');
        element.className = `h-3 w-3 rounded-full bg-white border-2 border-black cursor-pointer`;

        let marker = new mapboxgl.Marker({
            draggable: true,
            className: 'z-10',
            element
        }).setLngLat(anchor.point.getCoordinates());

        Object.defineProperty(marker, '_simplified', {
            value: anchor
        });
        anchor.marker = marker;

        let lastDragEvent = 0;
        marker.on('dragstart', (e) => {
            lastDragEvent = Date.now();
            this.map.getCanvas().style.cursor = 'grabbing';
            element.classList.add('cursor-grabbing');
        });
        marker.on('dragend', () => {
            lastDragEvent = Date.now();
            this.map.getCanvas().style.cursor = '';
            element.classList.remove('cursor-grabbing');
        });
        marker.on('dragend', this.moveAnchor.bind(this));
        marker.getElement().addEventListener('click', (e) => {
            if (Date.now() - lastDragEvent < 100) { // Prevent click event during drag
                return;
            }

            marker.setPopup(this.popup);
            marker.togglePopup();
            e.stopPropagation();

            let deleteThisAnchor = this.getDeleteAnchor(anchor);
            this.popupElement.addEventListener('delete', deleteThisAnchor); // Register the delete event for this anchor
            this.popup.once('close', () => {
                this.popupElement.removeEventListener('delete', deleteThisAnchor);
            });
        });

        this.markers.push(marker);
    }

    toggleMarkersForZoomLevelAndBounds() { // Show markers only if they are in the current zoom level and bounds
        this.shownMarkers.splice(0, this.shownMarkers.length);

        let zoom = this.map.getZoom();
        this.markers.forEach((marker) => {
            Object.defineProperty(marker, '_inZoom', {
                value: marker._simplified.zoom <= zoom,
                writable: true
            });
            if (marker._inZoom && this.map.getBounds().contains(marker.getLngLat())) {
                marker.addTo(this.map);
                this.shownMarkers.push(marker);
            } else {
                marker.remove();
            }
        });
    }

    showTemporaryAnchor(e: any) {
        if (!this.temporaryAnchor.marker) {
            return;
        }

        if (this.temporaryAnchorCloseToOtherAnchor(e)) {
            return;
        }

        this.temporaryAnchor.point.setCoordinates({
            lat: e.lngLat.lat,
            lon: e.lngLat.lng
        });
        this.temporaryAnchor.marker.setLngLat(this.temporaryAnchor.point.getCoordinates()).addTo(this.map);

        this.map.on('mousemove', this.hideTemporaryAnchorBinded);
    }

    hideTemporaryAnchor(e: any) {
        if (!this.temporaryAnchor.marker) {
            return;
        }

        if (this.temporaryAnchor.marker.getElement().classList.contains('cursor-grabbing')) { // Do not hide if it is being dragged, and stop listening for mousemove
            this.map.off('mousemove', this.hideTemporaryAnchorBinded);
            return;
        }

        if (e.point.dist(this.map.project(this.temporaryAnchor.point.getCoordinates())) > 20 || this.temporaryAnchorCloseToOtherAnchor(e)) { // Hide if too far from the layer
            this.temporaryAnchor.marker.remove();
            this.map.off('mousemove', this.hideTemporaryAnchorBinded);
            return;
        }

        this.temporaryAnchor.marker.setLngLat(e.lngLat); // Update the position of the temporary anchor
    }

    temporaryAnchorCloseToOtherAnchor(e: any) {
        for (let marker of this.shownMarkers) {
            if (marker === this.temporaryAnchor.marker) {
                continue;
            }
            if (e.point.dist(this.map.project(marker.getLngLat())) < 10) {
                return true;
            }
        }
        return false;
    }


    async moveAnchor(e: any) { // Move the anchor and update the route from and to the neighbouring anchors
        let marker = e.target;
        let anchor = marker._simplified;

        if (marker._temporary) { // Temporary anchor, need to find the closest point of the segment and create an anchor for it
            marker.remove();
            anchor = this.getPermanentAnchor(anchor);
            marker = anchor.marker;
        }

        let latlng = marker.getLngLat();
        let coordinates = {
            lat: latlng.lat,
            lon: latlng.lng
        };

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
            marker.setLngLat(anchor.point.getCoordinates());
        }
    }

    getPermanentAnchor(anchor: SimplifiedTrackPoint) {
        // Find the closest point closest to the temporary anchor
        let minDistance = Number.MAX_VALUE;
        let minPoint: TrackPoint | null = null;
        for (let segment of get(this.file).getSegments()) {
            for (let point of segment.trkpt) {
                let dist = distance(point.getCoordinates(), anchor.point.getCoordinates());
                if (dist < minDistance) {
                    minDistance = dist;
                    minPoint = point;
                }
            }
        }

        if (!minPoint) {
            return anchor;
        }

        let segment = minPoint._data.segment;
        let newAnchorIndex = segment._data.anchors.findIndex((a) => a.point._data.index >= minPoint._data.index);

        if (segment._data.anchors[newAnchorIndex].point._data.index === minPoint._data.index) { // Anchor already exists for this point
            return segment._data.anchors[newAnchorIndex];
        }

        let newAnchor = {
            point: minPoint,
            zoom: 0
        };
        this.createMarker(newAnchor);

        let marker = this.markers.pop();
        marker?.setLngLat(anchor.marker.getLngLat()).addTo(this.map);

        segment._data.anchors.splice(newAnchorIndex, 0, newAnchor);
        this.markers.splice(newAnchorIndex, 0, marker);

        return newAnchor;
    }

    getDeleteAnchor(anchor: SimplifiedTrackPoint) {
        return () => this.deleteAnchor(anchor);
    }

    async deleteAnchor(anchor: SimplifiedTrackPoint) { // Remove the anchor and route between the neighbouring anchors if they exist
        let [previousAnchor, nextAnchor] = this.getNeighbouringAnchors(anchor);

        if (previousAnchor === null) {
            // remove trackpoints until nextAnchor
        } else if (nextAnchor === null) {
            // remove trackpoints from previousAnchor
        } else {
            // route between previousAnchor and nextAnchor
            this.routeBetweenAnchors([previousAnchor, nextAnchor], [previousAnchor.point.getCoordinates(), nextAnchor.point.getCoordinates()]);
        }
    }

    async appendAnchor(e: mapboxgl.MapMouseEvent) { // Add a new anchor to the end of the last segment
        let segments = get(this.file).getSegments();
        if (segments.length === 0) {
            return;
        }

        let segment = segments[segments.length - 1];
        let anchors = segment._data.anchors;
        let lastAnchor = anchors[anchors.length - 1];

        let newPoint = new TrackPoint({
            attributes: {
                lon: e.lngLat.lng,
                lat: e.lngLat.lat
            }
        });
        newPoint._data.index = segment.trkpt.length - 1; // Do as if the point was the last point in the segment
        newPoint._data.segment = segment;
        let newAnchor = {
            point: newPoint,
            zoom: 0
        };
        this.createMarker(newAnchor);
        segment._data.anchors.push(newAnchor);

        let success = await this.routeBetweenAnchors([lastAnchor, newAnchor], [lastAnchor.point.getCoordinates(), newAnchor.point.getCoordinates()]);

        if (!success) { // Route failed, remove the anchor
            segment._data.anchors.pop();
            this.markers.pop()?.remove();
        }
    }

    getNeighbouringAnchors(anchor: SimplifiedTrackPoint): [SimplifiedTrackPoint | null, SimplifiedTrackPoint | null] {
        let previousAnchor: SimplifiedTrackPoint | null = null;
        let nextAnchor: SimplifiedTrackPoint | null = null;

        let segment = anchor.point._data.segment;
        let anchors = segment._data.anchors;
        for (let i = 0; i < anchors.length; i++) {
            if (anchors[i].point._data.index < anchor.point._data.index &&
                anchors[i].point._data.segment === anchor.point._data.segment &&
                anchors[i].marker._inZoom) {
                if (!previousAnchor || anchors[i].point._data.index > previousAnchor.point._data.index) {
                    previousAnchor = anchors[i];
                }
            } else if (anchors[i].point._data.index > anchor.point._data.index &&
                anchors[i].point._data.segment === anchor.point._data.segment &&
                anchors[i].marker._inZoom) {
                if (!nextAnchor || anchors[i].point._data.index < nextAnchor.point._data.index) {
                    nextAnchor = anchors[i];
                }
            }
        }

        return [previousAnchor, nextAnchor];
    }

    async routeBetweenAnchors(anchors: SimplifiedTrackPoint[], targetCoordinates: Coordinates[]): Promise<boolean> {
        if (anchors.length === 1) {
            anchors[0].point.setCoordinates(targetCoordinates[0]);
            return true;
        }

        let segment = anchors[0].point._data.segment;

        let response: TrackPoint[];
        try {
            response = await route(targetCoordinates);
        } catch (e) {
            if (e.message.includes('from-position not mapped in existing datafile')) {
                toast.error(get(_)("toolbar.routing.error.from"));
            } else if (e.message.includes('via1-position not mapped in existing datafile')) {
                toast.error(get(_)("toolbar.routing.error.via"));
            } else if (e.message.includes('to-position not mapped in existing datafile')) {
                toast.error(get(_)("toolbar.routing.error.to"));
            } else {
                toast.error(e.message);
            }
            return false;
        }

        let start = anchors[0].point._data.index + 1;
        let end = anchors[anchors.length - 1].point._data.index - 1;

        if (anchors[0].point._data.index === 0) { // First anchor is the first point of the segment
            anchors[0].point = response[0]; // Update the first anchor in case it was not on a road
            start--; // Remove the original first point
        }

        if (anchors[anchors.length - 1].point._data.index === anchors[anchors.length - 1].point._data.segment.trkpt.length - 1) { // Last anchor is the last point of the segment
            anchors[anchors.length - 1].point = response[response.length - 1]; // Update the last anchor in case it was not on a road
            end++; // Remove the original last point
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
            anchor.zoom = 0; // Make these anchors permanent
            anchor.marker.setLngLat(anchor.point.getCoordinates()); // Update the marker position if needed
        });

        applyToFileElement(this.file, segment, (segment) => {
            segment.replace(start, end, response);
        }, true);

        return true;
    }
}