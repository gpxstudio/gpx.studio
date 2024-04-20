import { writable, get } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX } from 'gpx';

export const map = writable<mapboxgl.Map | null>(null);
export const files = writable<GPXFile[]>([]);
export const selectedFiles = writable<Set<GPXFile>>(new Set());
export const selectFiles = writable<{ [key: string]: (file: GPXFile) => void }>({});

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
        await loadFile(list[i]);
        if (i == 0) {
            get(selectFiles).select(get(files)[get(files).length - 1]);
        }
    }
}

export async function loadFile(file: File) {
    let result = await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            let data = reader.result?.toString() ?? null;
            if (data) {
                let gpx = parseGPX(data);
                if (gpx.metadata.name === undefined) {
                    gpx.metadata['name'] = file.name.split('.').slice(0, -1).join('.');
                }
                files.update($files => [...$files, gpx]);
            }
            resolve();
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
    files.update($files => [...$files, clone]);
}

export function removeSelectedFiles() {
    let index = 0;
    while (index < get(files).length) {
        if (get(selectedFiles).has(get(files)[index])) {
            files.update($files => {
                $files.splice(index, 1);
                return $files;
            });
        } else {
            index++;
        }
    }
    get(selectedFiles).clear();
}

export function removeAllFiles() {
    files.update($files => {
        $files.splice(0, $files.length);
        return $files;
    });
    get(selectedFiles).clear();
}

export function exportSelectedFiles() {
    get(selectedFiles).forEach(file => exportFile(file));
}

export async function exportAllFiles() {
    for (let i = 0; i < get(files).length; i++) {
        exportFile(get(files)[i]);
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