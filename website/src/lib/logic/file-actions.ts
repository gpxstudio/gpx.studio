import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { i18n } from '$lib/i18n.svelte';
import { get } from 'svelte/store';
import { boundsManager } from './bounds';
import { engine } from '$lib/engine';
import { defaultFileName } from '$lib/default-file-name';

/** The name of a new file: the translated default name, numbered if other files have it. */
export function newFileName() {
    const names = [...get(engine.files).values()].map((file) => get(file).structure.name);
    return defaultFileName(i18n._('menu.new_file'), names);
}

export function createFile() {
    // the engine selects the new file
    engine.newFile(newFileName());
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

/**
 * Loads GPX files in the engine, as a single command: one undo step, the first file that could be
 * read is selected, and the map fits the files. A file without name is named like the file on
 * disk. Returns the ids of the files that were added.
 */
export async function loadFiles(list: FileList | File[]): Promise<string[]> {
    const files = await Promise.all(
        Array.from(list).map(async (file) => ({
            data: new Uint8Array(await file.arrayBuffer()),
            name: file.name.split('.').slice(0, -1).join('.'),
        }))
    );

    const before = new Set(get(engine.order));
    await engine.loadFiles(files);

    const ids = get(engine.order).filter((id) => !before.has(id));
    if (ids.length > 0) {
        boundsManager.fitBoundsOnLoad(ids);
    }
    return ids;
}
