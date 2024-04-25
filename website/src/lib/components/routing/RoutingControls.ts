import type { Coordinates, GPXFile } from "gpx";
import { get, type Writable } from "svelte/store";
import { computeAnchorPoints } from "./Simplify";
import mapboxgl from "mapbox-gl";
import { route } from "./Routing";
import { applyToFileStore } from "$lib/stores";

export class RoutingControls {
    map: mapboxgl.Map;
    file: Writable<GPXFile>;
    markers: mapboxgl.Marker[] = [];
    unsubscribe: () => void = () => { };

    toggleMarkersForZoomLevelAndBoundsBinded: () => void = this.toggleMarkersForZoomLevelAndBounds.bind(this);
    extendFileBinded: (e: mapboxgl.MapMouseEvent) => void = this.extendFile.bind(this);

    constructor(map: mapboxgl.Map, file: Writable<GPXFile>) {
        this.map = map;
        this.file = file;

        computeAnchorPoints(get(file));
        this.createMarkers();
        this.add();
    }

    add() {
        this.toggleMarkersForZoomLevelAndBounds();
        this.map.on('zoom', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.on('move', this.toggleMarkersForZoomLevelAndBoundsBinded);
        this.map.on('click', this.extendFileBinded);

        this.unsubscribe = this.file.subscribe(this.updateControls.bind(this));
    }

    updateControls() {
        // Update controls
        console.log('updateControls');
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

    createMarkers() {
        for (let segment of get(this.file).getSegments()) {
            for (let anchor of segment._data.anchors) {
                let marker = getMarker(anchor.point.getCoordinates(), true);
                Object.defineProperty(marker, '_simplified', {
                    value: anchor
                });
                this.markers.push(marker);
            }
        }
    }

    toggleMarkersForZoomLevelAndBounds() {
        let zoom = this.map.getZoom();
        this.markers.forEach((marker) => {
            if (marker._simplified.zoom <= zoom && this.map.getBounds().contains(marker.getLngLat())) {
                marker.addTo(this.map);
            } else {
                marker.remove();
            }
        });
    }

    async extendFile(e: mapboxgl.MapMouseEvent) {
        let segments = get(this.file).getSegments();
        if (segments.length === 0) {
            return;
        }
        let anchors = segments[segments.length - 1]._data.anchors;
        let lastAnchor = anchors[anchors.length - 1];

        let newPoint = {
            lon: e.lngLat.lng,
            lat: e.lngLat.lat
        };

        let response = await route([lastAnchor.point.getCoordinates(), newPoint]);

        applyToFileStore(this.file, (f) => f.append(response), true);
    }
}

export function getMarker(coordinates: Coordinates, draggable: boolean = false): mapboxgl.Marker {
    let element = document.createElement('div');
    element.className = `h-3 w-3 rounded-full bg-background border-2 border-black cursor-pointer`;
    return new mapboxgl.Marker({
        draggable,
        element
    }).setLngLat(coordinates);
}