import { writable, get } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX } from 'gpx';

export const map = writable<mapboxgl.Map | null>(null);
export const files = writable<GPXFile[]>([]);
export const selectedFiles = writable<Set<GPXFile>>(new Set());

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

export function loadFiles(files: FileList) {
    for (let i = 0; i < files.length; i++) {
        loadFile(files[i]);
    }
}

export function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
        let data = reader.result?.toString() ?? null;
        if (data) {
            let gpx = parseGPX(data);
            if (gpx.metadata.name === undefined) {
                gpx.metadata['name'] = file.name.split('.').slice(0, -1).join('.');
            }
            files.update($files => [...$files, gpx]);
            selectFile(gpx);
        }
    };
    reader.readAsText(file);
}

export function duplicateSelectedFiles() {
    let selected: GPXFile[] = [];
    get(selectedFiles).forEach(file => selected.push(file));
    selected.forEach(file => duplicateFile(file));
}

export function duplicateFile(file: GPXFile) {
    let clone = file.clone();
    files.update($files => [...$files, clone]);
    selectFile(clone);
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
    selectedFiles.update($selectedFiles => {
        $selectedFiles.clear();
        return $selectedFiles;
    });
}

export function removeAllFiles() {
    files.update($files => {
        $files.splice(0, $files.length);
        return $files;
    });
    selectedFiles.update($selectedFiles => {
        $selectedFiles.clear();
        return $selectedFiles;
    });
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

export function selectFile(file: GPXFile) {
    selectedFiles.update($selectedFiles => {
        $selectedFiles.clear();
        $selectedFiles.add(file);
        return $selectedFiles;
    });
}

export function addSelectFile(file: GPXFile) {
    selectedFiles.update($selectedFiles => {
        $selectedFiles.add(file);
        return $selectedFiles;
    });
}