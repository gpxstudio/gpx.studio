import { engine, type ExportOptions } from '$lib/engine';
import FileSaver from 'file-saver';
import JSZip from 'jszip';
import { get } from 'svelte/store';
import { sanitizeFileName, uniqueFileNames } from './file-names';

export enum ExportState {
    NONE,
    SELECTION,
    ALL,
}
export const exportState = $state({
    current: ExportState.NONE,
});

/** The files that contain the selection, in the order of the selection. */
export function selectedFileIds(): string[] {
    const selection = get(engine.selection);
    switch (selection.type) {
        case 'file':
            return selection.fileIds;
        case 'empty':
            return [];
        default:
            return [selection.fileId];
    }
}

export function allFileIds(): string[] {
    return get(engine.order);
}

async function exportFiles(fileIds: string[], options: ExportOptions) {
    const files = fileIds.flatMap((fileId) => {
        const gpx = engine.exportFile(fileId, options);
        const name = get(engine.files).get(fileId);
        return gpx === undefined || !name ? [] : [{ name: get(name).structure.name, gpx }];
    });

    if (files.length === 1) {
        const blob = new Blob([files[0].gpx], { type: 'application/gpx+xml' });
        FileSaver.saveAs(blob, `${sanitizeFileName(files[0].name)}.gpx`);
    } else if (files.length > 1) {
        const zip = new JSZip();
        const names = uniqueFileNames(files.map((file) => file.name));
        files.forEach(({ gpx }, i) => zip.file(`${names[i]}.gpx`, gpx));
        const blob = await zip.generateAsync({ type: 'blob' });
        FileSaver.saveAs(blob, 'gpx-files.zip');
    }
}

export async function exportSelectedFiles(options: ExportOptions) {
    await exportFiles(selectedFileIds(), options);
}

export async function exportAllFiles(options: ExportOptions) {
    await exportFiles(allFileIds(), options);
}
