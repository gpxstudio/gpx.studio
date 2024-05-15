import { writable, get, type Writable } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX, GPXStatistics, type Coordinates } from 'gpx';
import { tick } from 'svelte';
import { _ } from 'svelte-i18n';
import type { GPXLayer } from '$lib/components/gpx-layer/GPXLayer';
import { dbUtils, fileObservers } from './db';

export const map = writable<mapboxgl.Map | null>(null);

export const fileOrder = writable<string[]>([]);
export const selectedFiles = writable<Set<string>>(new Set());
export const selectFiles = writable<{ [key: string]: (fileId?: string) => void }>({});

fileObservers.subscribe((files) => { // Update selectedFiles automatically when files are deleted (either by action or by undo-redo)
    let deletedFileIds: string[] = [];
    get(selectedFiles).forEach((fileId) => {
        if (!files.has(fileId)) {
            deletedFileIds.push(fileId);
        }
    });
    if (deletedFileIds.length > 0) {
        selectedFiles.update((selectedFiles) => {
            deletedFileIds.forEach((fileId) => selectedFiles.delete(fileId));
            return selectedFiles;
        });
    }
});

export const gpxStatistics: Writable<GPXStatistics> = writable(new GPXStatistics());

function updateGPXData() {
    let fileIds: string[] = get(fileOrder).filter((f) => get(selectedFiles).has(f));
    gpxStatistics.set(fileIds.reduce((stats: GPXStatistics, fileId: string) => {
        let fileStore = get(fileObservers).get(fileId);
        if (fileStore) {
            let statistics = get(fileStore)?.statistics;
            if (statistics) {
                stats.mergeWith(statistics);
            }
        }
        return stats;
    }, new GPXStatistics()));
}

let unsubscribes: Function[] = [];
selectedFiles.subscribe((selectedFiles) => { // Maintain up-to-date statistics for the current selection
    updateGPXData();

    while (unsubscribes.length > 0) {
        unsubscribes.pop()();
    }

    selectedFiles.forEach((fileId) => {
        let fileObserver = get(fileObservers).get(fileId);
        if (fileObserver) {
            let first = true;
            unsubscribes.push(fileObserver.subscribe(() => {
                if (first) first = false;
                else updateGPXData();
            }));
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

export const gpxLayers: Writable<Map<string, GPXLayer>> = writable(new Map());

export enum Tool {
    ROUTING,
    TIME,
    REVERSE,
    MERGE,
    EXTRACT,
    WAYPOINT,
    REDUCE,
    CLEAN,
    STYLE,
    STRUCTURE
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
                get(selectFiles).select(fileId);
            });
            unsubscribe();
        }
    });
}

export function exportSelectedFiles() {
    get(fileObservers).forEach(async (file, fileId) => {
        if (get(selectedFiles).has(fileId)) {
            let f = get(file);
            if (f) {
                exportFile(f.file);
                await new Promise(resolve => setTimeout(resolve, 200));
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