import { dbUtils } from "$lib/db";
import type { Waypoint } from "gpx";
import mapboxgl from "mapbox-gl";
import { writable } from "svelte/store";

export const currentPopupWaypoint = writable<[Waypoint, string] | null>(null);

export const waypointPopup = new mapboxgl.Popup({
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

export function deleteWaypoint(fileId: string, waypointIndex: number) {
    dbUtils.applyToFile(fileId, (file) => file.replaceWaypoints(waypointIndex, waypointIndex, []));
}