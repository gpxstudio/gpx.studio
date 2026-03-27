import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';

export class GoogleRedirect {
    map: maplibregl.Map;
    enabled = false;

    constructor(map: maplibregl.Map) {
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

    openStreetView(e: maplibregl.MapMouseEvent) {
        window.open(
            `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.lngLat.lat},${e.lngLat.lng}`
        );
    }
}
