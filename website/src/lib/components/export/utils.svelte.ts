import { getFile, settings } from '$lib/db';
import { applyToOrderedSelectedItemsFromFile } from '$lib/components/file-list/Selection';
import { get } from 'svelte/store';
import { buildGPX, type GPXFile } from 'gpx';
import FileSaver from 'file-saver';
import JSZip from 'jszip';

const { fileOrder } = settings;

export enum ExportState {
    NONE,
    SELECTION,
    ALL,
}
export const exportState = $state({
    current: ExportState.NONE,
});

async function exportFiles(fileIds: string[], exclude: string[]) {
    if (fileIds.length > 1) {
        await exportFilesAsZip(fileIds, exclude);
    } else {
        const firstFileId = fileIds.at(0);
        if (firstFileId != null) {
            const file = getFile(firstFileId);
            if (file) {
                exportFile(file, exclude);
            }
        }
    }
}

export async function exportSelectedFiles(exclude: string[]) {
    const fileIds: string[] = [];
    applyToOrderedSelectedItemsFromFile(async (fileId, level, items) => {
        fileIds.push(fileId);
    });
    await exportFiles(fileIds, exclude);
}

export async function exportAllFiles(exclude: string[]) {
    await exportFiles(get(fileOrder), exclude);
}

function exportFile(file: GPXFile, exclude: string[]) {
    const blob = new Blob([buildGPX(file, exclude)], { type: 'application/gpx+xml' });
    FileSaver.saveAs(blob, `${file.metadata.name}.gpx`);
}

async function exportFilesAsZip(fileIds: string[], exclude: string[]) {
    const zip = new JSZip();
    for (const fileId of fileIds) {
        const file = getFile(fileId);
        if (file) {
            const gpx = buildGPX(file, exclude);
            let filename = file.metadata.name;
            for (let i = 1; zip.files[filename + '.gpx']; i++) {
                filename = file.metadata.name + `-${i}`;
            }
            zip.file(filename + '.gpx', gpx);
        }
    }
    if (Object.keys(zip.files).length > 0) {
        const blob = await zip.generateAsync({ type: 'blob' });
        FileSaver.saveAs(blob, 'gpx-files.zip');
    }
}
