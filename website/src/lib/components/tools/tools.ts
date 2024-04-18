import { files } from '$lib/stores';

import { parseGPX } from 'gpx';

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
        }
    };
    reader.readAsText(file);
}