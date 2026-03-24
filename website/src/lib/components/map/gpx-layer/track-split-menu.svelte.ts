import type { Coordinates } from 'gpx';
import { writable } from 'svelte/store';

export type TrackSplitTarget = {
    fileId: string;
    trackIndex: number;
    segmentIndex: number;
    coordinates: Coordinates;
    screenX: number;
    screenY: number;
};

export const trackSplitMenu = writable<TrackSplitTarget | null>(null);
export const trackSplitDialog = writable<TrackSplitTarget | null>(null);

export function openTrackSplitMenu(target: TrackSplitTarget) {
    trackSplitMenu.set(target);
}

export function closeTrackSplitMenu() {
    trackSplitMenu.set(null);
}

export function openTrackSplitDialog(target: TrackSplitTarget) {
    trackSplitDialog.set(target);
}

export function closeTrackSplitDialog() {
    trackSplitDialog.set(null);
}
