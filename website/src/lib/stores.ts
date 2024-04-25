import { writable, get, type Writable } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX } from 'gpx';

export const map = writable<mapboxgl.Map | null>(null);
export const files = writable<Writable<GPXFile>[]>([]);
export const fileOrder = writable<GPXFile[]>([]);
export const selectedFiles = writable<Set<GPXFile>>(new Set());
export const selectFiles = writable<{ [key: string]: (file?: GPXFile) => void }>({});
export const settings = writable<{ [key: string]: any }>({
    distanceUnits: 'metric',
    velocityUnits: 'speed',
    temperatureUnits: 'celsius',
});
export enum Tool {
    ROUTING
}
export const currentTool = writable<Tool | null>(null);

export function getFileStore(file: GPXFile): Writable<GPXFile> {
    return get(files).find(store => get(store) === file) ?? addFile(file);
}

export function getFileIndex(file: GPXFile): number {
    return get(files).findIndex(store => get(store) === file);
}

export function applyToFile(file: GPXFile, callback: (file: GPXFile) => void, updateSelected: boolean) {
    let store = getFileStore(file);
    store.update($file => {
        callback($file)
        return $file;
    });
    if (updateSelected) {
        selectedFiles.update($selected => $selected);
    }
}

export function applyToSelectedFiles(callback: (file: GPXFile) => void, updateSelected: boolean) {
    get(fileOrder).forEach(file => {
        if (get(selectedFiles).has(file)) {
            applyToFile(file, callback, false);
        }
    });
    if (updateSelected) {
        selectedFiles.update($selected => $selected);
    }
}

export function addFile(file: GPXFile): Writable<GPXFile> {
    let fileStore = writable(file);
    files.update($files => {
        $files.push(fileStore);
        return $files;
    });
    return fileStore;
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
    if (get(files).length > 0) {
        mapBounds = get(map)?.getBounds() ?? mapBounds;
        bounds.extend(mapBounds);
    }
    for (let i = 0; i < list.length; i++) {
        let file = await loadFile(list[i]);
        if (file) {
            if (i == 0) {
                get(selectFiles).select(get(file));
            }

            let fileBounds = get(file).getStatistics().bounds;
            bounds.extend(fileBounds.southWest);
            bounds.extend(fileBounds.northEast);
            bounds.extend([fileBounds.southWest.lon, fileBounds.northEast.lat]);
            bounds.extend([fileBounds.northEast.lon, fileBounds.southWest.lat]);

            if (!mapBounds.contains(bounds.getSouthWest()) || !mapBounds.contains(bounds.getNorthEast()) || !mapBounds.contains(bounds.getSouthEast()) || !mapBounds.contains(bounds.getNorthWest())) {
                get(map)?.fitBounds(bounds, {
                    padding: 80,
                    linear: true,
                    easing: () => 1
                });
            }
        }
    }
}

export async function loadFile(file: File) {
    let result = await new Promise<Writable<GPXFile> | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            let data = reader.result?.toString() ?? null;
            if (data) {
                let gpx = parseGPX(data);
                if (gpx.metadata.name === undefined) {
                    gpx.metadata['name'] = file.name.split('.').slice(0, -1).join('.');
                }
                resolve(addFile(gpx));
            } else {
                resolve(null);
            }
        };
        reader.readAsText(file);
    });
    return result;
}

export function duplicateSelectedFiles() {
    applyToSelectedFiles(file => {
        let clone = file.clone();
        addFile(clone);
    }, false);
}

export function removeSelectedFiles() {
    files.update($files => {
        let index = 0;
        while (index < $files.length) {
            if (get(selectedFiles).has(get($files[index]))) {
                $files.splice(index, 1);
            } else {
                index++;
            }
        }
        return $files;
    });
    selectedFiles.update($selected => {
        $selected.clear();
        return $selected;
    });
}

export function removeAllFiles() {
    files.update($files => {
        $files.splice(0, $files.length);
        return $files;
    });
    selectedFiles.update($selected => {
        $selected.clear();
        return $selected;
    });
}

export function exportSelectedFiles() {
    get(selectedFiles).forEach(file => exportFile(file));
}

export async function exportAllFiles() {
    for (let file of get(files)) {
        exportFile(get(file));
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

export function reverseSelectedFiles() {
    selectedFiles.update($selected => {
        $selected.forEach(file => applyToFile(file, file => file.reverse(), false));
        return $selected;
    });
}