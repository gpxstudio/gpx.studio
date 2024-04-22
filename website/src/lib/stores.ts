import { writable, get } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, GPXFiles, buildGPX, parseGPX } from 'gpx';

export const map = writable<mapboxgl.Map | null>(null);
export const fileCollection = writable<GPXFiles>(new GPXFiles([]));
export const fileOrder = writable<GPXFile[]>([]);
export const selectedFiles = writable<Set<GPXFile>>(new Set());
export const selectFiles = writable<{ [key: string]: (file?: GPXFile) => void }>({});

export function addFile(file: GPXFile) {
    fileCollection.update($files => {
        $files.files.push(file);
        return $files;
    });
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
    for (let i = 0; i < list.length; i++) {
        let file = await loadFile(list[i]);
        if (i == 0 && file) {
            get(selectFiles).select(file);
        }
    }
}

export async function loadFile(file: File) {
    let result = await new Promise<GPXFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            let data = reader.result?.toString() ?? null;
            if (data) {
                let gpx = parseGPX(data);
                if (gpx.metadata.name === undefined) {
                    gpx.metadata['name'] = file.name.split('.').slice(0, -1).join('.');
                }
                addFile(gpx);
                resolve(gpx);
            } else {
                resolve(null);
            }
        };
        reader.readAsText(file);
    });
    return result;
}

export function duplicateSelectedFiles() {
    let selected: GPXFile[] = [];
    get(selectedFiles).forEach(file => selected.push(file));
    selected.forEach(file => duplicateFile(file));
}

export function duplicateFile(file: GPXFile) {
    let clone = file.clone();
    addFile(clone);
}

export function removeSelectedFiles() {
    let index = 0;
    while (index < get(fileCollection).files.length) {
        if (get(selectedFiles).has(get(fileCollection).files[index])) {
            fileCollection.update($files => {
                $files.files.splice(index, 1);
                return $files;
            });
        } else {
            index++;
        }
    }
    get(selectedFiles).clear();
}

export function removeAllFiles() {
    fileCollection.update($files => {
        $files.files.splice(0, $files.files.length);
        return $files;
    });
    get(selectedFiles).clear();
}

export function exportSelectedFiles() {
    get(selectedFiles).forEach(file => exportFile(file));
}

export async function exportAllFiles() {
    for (let file of get(fileCollection).files) {
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

export function reverseSelectedFiles() {
    get(selectedFiles).forEach(file => file.reverse());
}