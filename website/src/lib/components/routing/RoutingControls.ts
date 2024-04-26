import { distance, type Coordinates, type GPXFile, type TrackSegment } from "gpx";
import { get, type Writable } from "svelte/store";
import { computeAnchorPoints, type SimplifiedTrackPoint } from "./Simplify";
import mapboxgl from "mapbox-gl";
import { route } from "./Routing";
import { applyToFileElement, applyToFileStore } from "$lib/stores";

export class RoutingControls {
    map: mapboxgl.Map;
    file: Writable<GPXFile>;
    markers: mapboxgl.Marker[] = [];
    unsubscribe: () => void = () => { };

    toggleMarkersForZoomLevelAndBoundsBinded: () => void = this.toggleMarkersForZoomLevelAndBounds.bind(this);
    extendFileBinded: (e: mapboxgl.MapMouseEvent) => void = this.extendFile.bind(this);
    busy: boolean = false;

    constructor(map: mapboxgl.Map, file: Writable<GPXFile>) {
        this.map = map;
        this.file = file;
        this.add();
    }

    add() {
        this.map.on('zoom', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.on('move', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.on('click', this.extendFileBinded);

        this.unsubscribe = this.file.subscribe(this.updateControls.bind(this));
    }

    updateControls() {
        // Update controls
        for (let segment of get(this.file).getSegments()) {
            if (!segment._data.anchors) { // New segment
                computeAnchorPoints(segment);
                this.createMarkers(segment);
                continue;
            }

            let anchors = segment._data.anchors;
            for (let i = 0; i < anchors.length;) {
                let anchor = anchors[i];
                if (anchor.point._data.index >= segment.trkpt.length || anchor.point !== segment.trkpt[anchor.point._data.index]) { // Point removed
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
        this.map.off('click', this.extendFileBinded);

        this.unsubscribe();
    }

    createMarkers(segment: TrackSegment) {
        for (let anchor of segment._data.anchors) {
            this.createMarker(anchor);
        }
    }

    createMarker(anchor: SimplifiedTrackPoint) {
        let element = document.createElement('div');
        element.className = `h-3 w-3 rounded-full bg-background border-2 border-black cursor-pointer`;

        let marker = new mapboxgl.Marker({
            draggable: true,
            element
        }).setLngLat(anchor.point.getCoordinates());

        Object.defineProperty(marker, '_simplified', {
            value: anchor
        });
        anchor.marker = marker;

        marker.on('dragend', this.updateAnchor.bind(this));

        this.markers.push(marker);
    }

    toggleMarkersForZoomLevelAndBounds() {
        let zoom = this.map.getZoom();
        this.markers.forEach((marker) => {
            Object.defineProperty(marker, '_inZoom', {
                value: marker._simplified.zoom <= zoom,
                writable: true
            });
            if (marker._inZoom && this.map.getBounds().contains(marker.getLngLat())) {
                marker.addTo(this.map);
            } else {
                marker.remove();
            }
        });
    }

    async updateAnchor(e: any) {
        if (this.busy) {
            return;
        }
        this.busy = true;

        let marker = e.target;
        let anchor = marker._simplified;

        let latlng = marker.getLngLat();
        let coordinates = {
            lat: latlng.lat,
            lon: latlng.lng
        };

        let segment = anchor.point._data.segment;
        let anchors = segment._data.anchors;

        let previousAnchor: SimplifiedTrackPoint | null = null;
        let nextAnchor: SimplifiedTrackPoint | null = null;

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

        let routeCoordinates = [];
        if (previousAnchor) {
            routeCoordinates.push(previousAnchor.point.getCoordinates());
        }
        routeCoordinates.push(coordinates);
        if (nextAnchor) {
            routeCoordinates.push(nextAnchor.point.getCoordinates());
        }

        let start = previousAnchor ? previousAnchor.point._data.index + 1 : anchor.point._data.index;
        let end = nextAnchor ? nextAnchor.point._data.index - 1 : anchor.point._data.index;

        if (routeCoordinates.length === 1) {
            anchor.point.setCoordinates(coordinates);
        } else {
            let response = await route(routeCoordinates);
            if (previousAnchor !== null) {
                previousAnchor.zoom = 0;
            } else {
                anchor.zoom = 0;
                anchor.point = response[0];
            }
            if (nextAnchor !== null) {
                nextAnchor.zoom = 0;
            } else {
                anchor.zoom = 0;
                anchor.point = response[response.length - 1];
            }

            // find closest point to the dragged marker
            // and transfer the marker to that point
            if (previousAnchor && nextAnchor) {
                let minDistance = Number.MAX_VALUE;
                let minIndex = 0;
                for (let i = 1; i < response.length - 1; i++) {
                    let dist = distance(response[i].getCoordinates(), coordinates);
                    if (dist < minDistance) {
                        minDistance = dist;
                        minIndex = i;
                    }
                }
                anchor.zoom = 0;
                anchor.point = response[minIndex];
            }

            marker.setLngLat(anchor.point.getCoordinates());

            applyToFileElement(this.file, segment, (segment) => {
                segment.replace(start, end, response);
            }, true);
        }

        this.busy = false;
    }

    async extendFile(e: mapboxgl.MapMouseEvent) {
        if (this.busy) {
            return;
        }
        this.busy = true;

        let segments = get(this.file).getSegments();
        if (segments.length === 0) {
            return;
        }

        let segment = segments[segments.length - 1];
        let anchors = segment._data.anchors;
        let lastAnchor = anchors[anchors.length - 1];

        let newPoint = {
            lon: e.lngLat.lng,
            lat: e.lngLat.lat
        };

        let response = await route([lastAnchor.point.getCoordinates(), newPoint]);

        let anchor = {
            point: response[response.length - 1],
            zoom: 0
        };
        segment._data.anchors.push(anchor);
        this.createMarker(anchor);

        applyToFileStore(this.file, (f) => f.append(response), true);

        this.busy = false;
    }
}