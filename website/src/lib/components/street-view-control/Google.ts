import { resetCursor, setCrosshairCursor } from "$lib/utils";
import type mapboxgl from "mapbox-gl";

export class GoogleRedirect {
    map: mapboxgl.Map;
    enabled = false;

    constructor(map: mapboxgl.Map) {
        this.map = map;
    }

    add() {
        if (this.enabled) return;

        this.enabled = true;
        setCrosshairCursor();
        this.map.on('click', this.openStreetView);
    }

    remove() {
        if (!this.enabled) return;

        this.enabled = false;
        resetCursor();
        this.map.off('click', this.openStreetView);
    }

    openStreetView(e) {
        window.open(
            `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.lngLat.lat},${e.lngLat.lng}`
        );
    }
}