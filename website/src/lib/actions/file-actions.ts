import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { i18n } from '$lib/i18n/i18n.svelte';
import { get } from 'svelte/store';
import { boundsManager } from '$lib/state/bounds';
import { engine } from '$lib/engine';
import { defaultFileName } from '$lib/actions/default-file-name';
import { askUnsaved } from '$lib/components/file-list/unsaved-prompt.svelte';
import { subfolder } from '$lib/engine/workspace';
import type { UnsavedChoice } from '$lib/engine';

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

/** Asks for the files to open: with the file picker of the system in the desktop app. */
export async function openFiles() {
    if (get(engine.workspace)) {
        const ids = await engine.openFiles();
        if (ids.length > 0) {
            boundsManager.fitBoundsOnLoad(ids);
        }
    } else {
        triggerFileInput();
    }
}

/**
 * What to do with the files of the open folder that have unsaved changes, which the user is asked
 * when there are some: `undefined` when there are none, `'cancel'` when they do not want to go on.
 */
async function askAboutUnsavedFiles(): Promise<UnsavedChoice | undefined | 'cancel'> {
    const workspace = get(engine.workspace);
    if (!workspace?.folder) {
        return undefined;
    }
    const files = get(engine.files);
    const names = Object.entries(workspace.files)
        // the files in the folder, and the new ones, which are saved in it
        .filter(
            ([, file]) =>
                file.dirty &&
                (file.path === undefined || subfolder(workspace.folder, file.path) !== undefined)
        )
        .map(([id]) => {
            const file = files.get(id);
            return file ? get(file).structure.name : id;
        });
    return names.length > 0 ? askUnsaved(names) : undefined;
}

/**
 * Opens a folder, which is watched (the desktop app). The folder that was open is closed: the user
 * is asked what to do with its unsaved files.
 */
export async function openFolder() {
    const unsaved = await askAboutUnsavedFiles();
    if (unsaved === 'cancel') {
        return;
    }
    const ids = await engine.openFolder(unsaved);
    if (ids.length > 0) {
        boundsManager.fitBoundsOnLoad(ids);
    }
}

/** Closes the open folder and its files: the user is asked what to do with the unsaved ones. */
export async function closeFolder() {
    const unsaved = await askAboutUnsavedFiles();
    if (unsaved !== 'cancel') {
        await engine.closeFolder(unsaved);
    }
}

/** Saves the selected files to the file system, all the ones that have unsaved edits if none is. */
export function saveSelected(selectedFileIds: string[]) {
    const workspace = get(engine.workspace);
    const ids =
        selectedFileIds.length > 0
            ? selectedFileIds
            : Object.keys(workspace?.files ?? {}).filter((id) => workspace?.files[id].dirty);
    if (ids.length > 0) {
        engine.save(ids);
    }
}

/** Saves all the files that have unsaved edits to the file system. */
export function saveAll() {
    const workspace = get(engine.workspace);
    const ids = Object.keys(workspace?.files ?? {}).filter((id) => workspace?.files[id].dirty);
    if (ids.length > 0) {
        engine.save(ids);
    }
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
