import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { i18n } from '$lib/i18n/i18n.svelte';
import { get } from 'svelte/store';
import { boundsManager } from '$lib/state/bounds';
import { engine } from '$lib/engine';
import { defaultFileName } from '$lib/actions/default-file-name';
import { askOverwrite, askUnsaved } from '$lib/components/file-list/unsaved-prompt.svelte';
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

/** The names of files, to show them to the user. */
function namesOf(ids: string[]): string[] {
    const files = get(engine.files);
    return ids.map((id) => {
        const file = files.get(id);
        return file ? get(file).structure.name : id;
    });
}

/** The ids among `ids` of the files that have changes that are not saved. */
function unsavedAmong(ids: string[]): string[] {
    const workspace = get(engine.workspace);
    return ids.filter((id) => workspace?.files[id]?.dirty);
}

/**
 * What to do with the files among `ids` that have unsaved changes, which the user is asked when
 * there are some: `undefined` when there are none, `'cancel'` when they do not want to go on.
 */
async function askAboutUnsavedFiles(ids: string[]): Promise<UnsavedChoice | undefined | 'cancel'> {
    const unsaved = unsavedAmong(ids);
    return unsaved.length > 0 ? askUnsaved(namesOf(unsaved)) : undefined;
}

/** All the open files. */
function allFileIds(): string[] {
    return get(engine.order);
}

/**
 * Opens a folder, which is watched (the desktop app). Its files are not opened, they are in its
 * tree. The folder that was open is closed with its files: the user is asked what to do with the
 * unsaved ones.
 */
export async function openFolder() {
    const unsaved = await askAboutUnsavedFiles(allFileIds());
    if (unsaved !== 'cancel') {
        await engine.openFolder(unsaved);
    }
}

/** Closes the open folder and all the files: the user is asked what to do with the unsaved ones. */
export async function closeFolder() {
    const unsaved = await askAboutUnsavedFiles(allFileIds());
    if (unsaved !== 'cancel') {
        await engine.closeFolder(unsaved);
    }
}

/** Closes files: the user is asked what to do with the ones that have unsaved changes. */
export async function closeFiles(ids: string[]) {
    if (ids.length === 0) {
        return;
    }
    const unsaved = await askAboutUnsavedFiles(ids);
    if (unsaved !== 'cancel') {
        await engine.closeFiles(ids, unsaved);
    }
}

/** Closes all the files. */
export function closeAll() {
    return closeFiles(allFileIds());
}

/**
 * Writes files to the file system. The user is asked first about the ones whose file was also
 * changed on the disk, which saving overwrites: they can take the disk instead of their changes.
 */
async function saveFiles(ids: string[]) {
    if (ids.length === 0) {
        return;
    }
    const workspace = get(engine.workspace);
    const replaced = ids.filter((id) => workspace?.files[id]?.replaced);
    if (replaced.length > 0) {
        const choice = await askOverwrite(namesOf(replaced));
        if (choice === 'cancel') {
            return;
        }
        if (choice === 'reload') {
            // they are the files on the disk now, there is nothing to save
            await engine.reload(replaced);
            ids = ids.filter((id) => !replaced.includes(id));
        }
    }
    if (ids.length > 0) {
        await engine.save(ids);
    }
}

/** Saves the selected files to the file system, all the ones that have unsaved edits if none is. */
export function saveSelected(selectedFileIds: string[]) {
    return saveFiles(selectedFileIds.length > 0 ? selectedFileIds : unsavedAmong(allFileIds()));
}

/** Saves all the files that have unsaved edits to the file system. */
export function saveAll() {
    return saveFiles(unsavedAmong(allFileIds()));
}

/** Saves a file where the user says, which is where it is from then on (not for several files). */
export async function saveAs(selectedFileIds: string[]) {
    if (selectedFileIds.length === 1) {
        await engine.saveAs(selectedFileIds[0]);
    }
}

/** Opens a file of the tree of the open folder. */
export async function openPath(path: string) {
    const ids = await engine.openPaths([path]);
    if (ids.length > 0) {
        boundsManager.fitBoundsOnLoad(ids);
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
