import { dbUtils } from "$lib/db";
import { MapPopup } from "$lib/components/MapPopup";

export let waypointPopup: MapPopup | null = null;
export let trackpointPopup: MapPopup | null = null;

export function createPopups(map: mapboxgl.Map) {
    removePopups();
    waypointPopup = new MapPopup(map, {
        closeButton: false,
        focusAfterOpen: false,
        maxWidth: undefined,
        offset: {
            'top': [0, 0],
            'top-left': [0, 0],
            'top-right': [0, 0],
            'bottom': [0, -30],
            'bottom-left': [0, -30],
            'bottom-right': [0, -30],
            'left': [10, -15],
            'right': [-10, -15],
        },
    });
    trackpointPopup = new MapPopup(map, {
        closeButton: false,
        focusAfterOpen: false,
        maxWidth: undefined,
    });
}

export function removePopups() {
    if (waypointPopup !== null) {
        waypointPopup.remove();
        waypointPopup = null;
    }
    if (trackpointPopup !== null) {
        trackpointPopup.remove();
        trackpointPopup = null;
    }
}

export function deleteWaypoint(fileId: string, waypointIndex: number) {
    dbUtils.applyToFile(fileId, (file) => file.replaceWaypoints(waypointIndex, waypointIndex, []));
}