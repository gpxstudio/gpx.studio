import { writable, get, type Writable, derived } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX, type AnyGPXTreeElement, GPXFiles } from 'gpx';
import { tick } from 'svelte';
import { _ } from 'svelte-i18n';
import type { GPXLayer } from '$lib/components/gpx-layer/GPXLayer';
import { createGPXFileStore } from './filestore';

export const map = writable<mapboxgl.Map | null>(null);

export const filestore = createGPXFileStore();
export const fileOrder = writable<string[]>([]);
export const selectedFiles = writable<Set<string>>(new Set());
export const selectFiles = writable<{ [key: string]: (fileId?: string) => void }>({});

export const gpxData = writable(new GPXFiles([]).getTrackPointsAndStatistics());

function updateGPXData() {
    let fileIds: string[] = get(fileOrder).filter((f) => get(selectedFiles).has(f));
    let files: GPXFile[] = fileIds
        .map((id) => get(filestore).find((f) => f._data.id === id))
        .filter((f) => f) as GPXFile[];
    let gpxFiles = new GPXFiles(files);
    gpxData.set(gpxFiles.getTrackPointsAndStatistics());
}

let selectedFilesUnsubscribe: Function[] = [];
selectedFiles.subscribe((selectedFiles) => {
    selectedFilesUnsubscribe.forEach((unsubscribe) => unsubscribe());
    selectedFiles.forEach((fileId) => {
        let fileStore = filestore.getFileStore(fileId);
        if (fileStore) {
            let unsubscribe = fileStore.subscribe(() => {
                updateGPXData();
            });
            selectedFilesUnsubscribe.push(unsubscribe);
        }
    });
    updateGPXData();
});

export const settings = writable<{ [key: string]: any }>({
    distanceUnits: 'metric',
    velocityUnits: 'speed',
    temperatureUnits: 'celsius',
    mode: 'system'
});
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

    filestore.add(file);

    tick().then(() => get(selectFiles).select(file._data.id));
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
    let bounds = new mapboxgl.LngLatBounds();
    let mapBounds = new mapboxgl.LngLatBounds([180, 90, -180, -90]);
    if (get(filestore).length > 0) {
        mapBounds = get(map)?.getBounds() ?? mapBounds;
        bounds.extend(mapBounds);
    }
    let files = [];
    for (let i = 0; i < list.length; i++) {
        let file = await loadFile(list[i]);
        if (file) {
            files.push(file);

            let fileBounds = file.getStatistics().bounds;
            bounds.extend(fileBounds.southWest);
            bounds.extend(fileBounds.northEast);
            bounds.extend([fileBounds.southWest.lon, fileBounds.northEast.lat]);
            bounds.extend([fileBounds.northEast.lon, fileBounds.southWest.lat]);
        }
    }

    filestore.addMultiple(files);

    if (!mapBounds.contains(bounds.getSouthWest()) || !mapBounds.contains(bounds.getNorthEast()) || !mapBounds.contains(bounds.getSouthEast()) || !mapBounds.contains(bounds.getNorthWest())) {
        get(map)?.fitBounds(bounds, {
            padding: 80,
            linear: true,
            easing: () => 1
        });
    }

    await tick();

    if (files.length > 0) {
        get(selectFiles).select(files[0]._data.id);
    }
}

export async function loadFile(file: File): Promise<GPXFile | null> {
    let result = await new Promise<GPXFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            let data = reader.result?.toString() ?? null;
            if (data) {
                let gpx = parseGPX(data);
                if (gpx.metadata.name === undefined) {
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

export async function exportSelectedFiles() {
    for (let file of get(filestore)) {
        if (get(selectedFiles).has(file._data.id)) {
            exportFile(file);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
}

export async function exportAllFiles() {
    for (let file of get(filestore)) {
        exportFile(file);
        await new Promise(resolve => setTimeout(resolve, 200));
    }
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