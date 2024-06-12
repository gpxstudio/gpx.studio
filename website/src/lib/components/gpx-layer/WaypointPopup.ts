import type { Waypoint } from "gpx";
import mapboxgl from "mapbox-gl";
import { writable } from "svelte/store";

export const currentPopupWaypoint = writable<Waypoint | null>(null);

export const waypointPopup = new mapboxgl.Popup({
    closeButton: false,
    maxWidth: undefined
});