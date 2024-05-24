import { writable, get, type Writable } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX, GPXStatistics, type Coordinates } from 'gpx';
import { tick } from 'svelte';
import { _ } from 'svelte-i18n';
import type { GPXLayer } from '$lib/components/gpx-layer/GPXLayer';
import { settings, dbUtils, fileObservers } from './db';
import { selectFile, selection } from '$lib/components/file-list/Selection';
import { ListFileItem, ListWaypointItem } from '$lib/components/file-list/FileList';
import type { RoutingControls } from '$lib/components/toolbar/tools/routing/RoutingControls';

export const map = writable<mapboxgl.Map | null>(null);
export const selectFiles = writable<{ [key: string]: (fileId?: string) => void }>({});

export const gpxStatistics: Writable<GPXStatistics> = writable(new GPXStatistics());

const { fileOrder } = settings;

function updateGPXData() {
    let statistics = new GPXStatistics();
    get(fileOrder).forEach((fileId) => { // Get statistics in the order of the file list
        let fileStore = get(fileObservers).get(fileId);
        if (fileStore) {
            let stats = get(fileStore)?.statistics;
            if (stats !== undefined) {
                let first = true;
                get(selection).getChild(fileId)?.getSelected().forEach((item) => { // Get statistics for selected items within the file
                    if (!(item instanceof ListWaypointItem) || first) {
                        statistics.mergeWith(stats.getStatisticsFor(item));
                        first = false;
                    }
                });
            }
        }
    });
    gpxStatistics.set(statistics);
}

let unsubscribes: Map<string, () => void> = new Map();
selection.subscribe(($selection) => { // Maintain up-to-date statistics for the current selection
    updateGPXData();

    while (unsubscribes.size > 0) {
        let [fileId, unsubscribe] = unsubscribes.entries().next().value;
        unsubscribe();
        unsubscribes.delete(fileId);
    }

    $selection.forEach((item) => {
        let fileId = item.getFileId();
        if (!unsubscribes.has(fileId)) {
            let fileObserver = get(fileObservers).get(fileId);
            if (fileObserver) {
                let first = true;
                unsubscribes.set(fileId, fileObserver.subscribe(() => {
                    if (first) first = false;
                    else updateGPXData();
                }));
            }
        }
    });
});

const targetMapBounds = writable({
    bounds: new mapboxgl.LngLatBounds([180, 90, -180, -90]),
    initial: true
});

targetMapBounds.subscribe((bounds) => {
    if (bounds.initial) {
        return;
    }

    let currentBounds = get(map)?.getBounds();
    if (currentBounds && currentBounds.contains(bounds.bounds.getSouthEast()) && currentBounds.contains(bounds.bounds.getNorthWest())) {
        return;
    }

    get(map)?.fitBounds(bounds.bounds, {
        padding: 80,
        linear: true,
        easing: () => 1
    });
});


export function initTargetMapBounds(first: boolean) {
    let bounds = new mapboxgl.LngLatBounds([180, 90, -180, -90]);
    let mapBounds = new mapboxgl.LngLatBounds([180, 90, -180, -90]);
    if (!first) { // Some files are already loaded
        mapBounds = get(map)?.getBounds() ?? mapBounds;
        bounds.extend(mapBounds);
    }
    targetMapBounds.set({
        bounds: bounds,
        initial: true
    });
}

export function updateTargetMapBounds(bounds: {
    southWest: Coordinates,
    northEast: Coordinates
}) {
    if (bounds.southWest.lat == 90 && bounds.southWest.lon == 180 && bounds.northEast.lat == -90 && bounds.northEast.lon == -180) { // Avoid update for empty (new) files
        return;
    }

    targetMapBounds.update((target) => {
        target.bounds.extend(bounds.southWest);
        target.bounds.extend(bounds.northEast);
        target.initial = false;
        return target;
    });
}

export const gpxLayers: Map<string, GPXLayer> = new Map();
export const routingControls: Map<string, RoutingControls> = new Map();

export enum Tool {
    ROUTING,
    WAYPOINT,
    TIME,
    MERGE,
    EXTRACT,
    REDUCE,
    CLEAN,
    STYLE
}
export const currentTool = writable<Tool | null>(null);

export function createFile() {
    let file = new GPXFile();
    file.metadata.name = get(_)("menu.new_filename");

    dbUtils.add(file);

    selectFileWhenLoaded(file._data.id);
    currentTool.set(Tool.ROUTING);
}

export function triggerFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gpx';
    input.multiple = true;
    input.className = 'hidden';
    input.onchange = () => {
        if (input.files) {
            loadFiles(input.files);
        }
    };
    input.click();
}

export async function loadFiles(list: FileList) {
    let files = [];
    for (let i = 0; i < list.length; i++) {
        let file = await loadFile(list[i]);
        if (file) {
            files.push(file);
        }
    }

    dbUtils.addMultiple(files);

    selectFileWhenLoaded(files[0]._data.id);
}

export async function loadFile(file: File): Promise<GPXFile | null> {
    let result = await new Promise<GPXFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            let data = reader.result?.toString() ?? null;
            if (data) {
                let gpx = parseGPX(data);
                if (gpx.metadata === undefined) {
                    gpx.metadata = { name: file.name.split('.').slice(0, -1).join('.') };
                } else if (gpx.metadata.name === undefined) {
                    gpx.metadata['name'] = file.name.split('.').slice(0, -1).join('.');
                }
                resolve(gpx);
            } else {
                resolve(null);
            }
        };
        reader.readAsText(file);
    });
    return result;
}

function selectFileWhenLoaded(fileId: string) {
    const unsubscribe = fileObservers.subscribe((files) => {
        if (files.has(fileId)) {
            tick().then(() => {
                selectFile(fileId);
            });
            unsubscribe();
        }
    });
}

export function exportSelectedFiles() {
    get(selection).forEach(async (item) => {
        if (item instanceof ListFileItem) {
            let fileStore = get(fileObservers).get(item.getFileId());
            if (fileStore) {
                let file = get(fileStore)?.file;
                if (file) {
                    exportFile(file);
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }
    });
}

export function exportAllFiles() {
    get(fileObservers).forEach(async (file) => {
        let f = get(file);
        if (f) {
            exportFile(f.file);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    });
}

export function exportFile(file: GPXFile) {
    let blob = new Blob([buildGPX(file)], { type: 'application/gpx+xml' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = file.metadata.name + '.gpx';
    a.click();
    URL.revokeObjectURL(url);
}