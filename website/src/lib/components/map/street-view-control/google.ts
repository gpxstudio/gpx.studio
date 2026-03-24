import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
import type mapboxgl from 'mapbox-gl';
import { eventCoord } from '$lib/utils/gcj02';

export class GoogleRedirect {
    map: mapboxgl.Map;
    enabled = false;

    constructor(map: mapboxgl.Map) {
        this.map = map;
    }

    add() {
        if (this.enabled) return;

        this.enabled = true;
        mapCursor.notify(MapCursorState.STREET_VIEW_CROSSHAIR, true);
        this.map.on('click', this.openStreetView);
    }

    remove() {
        if (!this.enabled) return;

        this.enabled = false;
        mapCursor.notify(MapCursorState.STREET_VIEW_CROSSHAIR, false);
        this.map.off('click', this.openStreetView);
    }

    openStreetView(e: mapboxgl.MapMouseEvent) {
        const ec = eventCoord(e.lngLat);
        window.open(
            `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ec.lat},${ec.lng}`
        );
    }
}
