import { dbUtils } from "$lib/db";
import type { Waypoint } from "gpx";
import mapboxgl from "mapbox-gl";
import { writable } from "svelte/store";

export const currentPopupWaypoint = writable<[Waypoint, string] | null>(null);

export const waypointPopup = new mapboxgl.Popup({
    closeButton: false,
    maxWidth: undefined
});

export function deleteWaypoint(fileId: string, waypointIndex: number) {
    dbUtils.applyToFile(fileId, (file) => file.replaceWaypoints(waypointIndex, waypointIndex, [])[0]);
}