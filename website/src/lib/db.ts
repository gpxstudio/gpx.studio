import Dexie, { liveQuery } from 'dexie';
import { GPXFile } from 'gpx';
import { type FreezedObject, type Patch, produceWithPatches, applyPatches } from 'structurajs';
import { writable, get, derived, type Readable, type Writable } from 'svelte/store';
import { fileOrder, selectedFiles } from './stores';

class Database extends Dexie {

    files!: Dexie.Table<FreezedObject<GPXFile>, string>;
    patches!: Dexie.Table<{ patch: Patch[], inversePatch: Patch[] }, number>;
    settings!: Dexie.Table<any, string>;

    constructor() {
        super("Database");
        this.version(1).stores({
            files: ',file',
            patches: '++id,patch,inversePatch',
            settings: ',value'
        });
    }
}

const db = new Database();

function dexieStore<T>(querier: () => T | Promise<T>): Readable<T> {
    const dexieObservable = liveQuery(querier)
    return {
        subscribe(run, invalidate) {
            return dexieObservable.subscribe(run, invalidate).unsubscribe
        }
    }
}

export function updateFiles(files: FreezedObject<GPXFile>[]) {
    console.log(files);
    return db.files.bulkPut(files, files.map(file => file._data.id));
}

export const fileObservers: Writable<Map<string, Readable<FreezedObject<GPXFile>>>> = writable(new Map());
export const fileState: Map<string, FreezedObject<GPXFile>> = new Map(); // Used to generate patches

liveQuery(() => db.files.toArray()).subscribe(dbFiles => {
    // Find new files to observe
    let newFiles = dbFiles.map(file => file._data.id).filter(id => !get(fileObservers).has(id));
    // Find deleted files to stop observing
    let deletedFiles = Array.from(get(fileObservers).keys()).filter(id => !dbFiles.find(file => file._data.id === id));
    // Update the store
    if (newFiles.length > 0 || deletedFiles.length > 0) {
        fileObservers.update($files => {
            newFiles.forEach(id => {
                $files.set(id, dexieStore(() => db.files.get(id)));
            });
            deletedFiles.forEach(id => {
                $files.delete(id);
                fileState.delete(id);
            });
            return $files;
        });
        console.log(get(fileObservers));
    }

    // Update fileState
    dbFiles.forEach(file => {
        fileState.set(file._data.id, file);
    });
});

const patchIndex = dexieStore(() => db.settings.get('patchIndex') ?? -1);
const patches = dexieStore(() => db.patches.toArray());
export const canUndo = derived(patchIndex, $patchIndex => $patchIndex >= 0);
export const canRedo = derived([patchIndex, patches], ([$patchIndex, $patches]) => $patchIndex < $patches.length - 1);

export function applyGlobal(callback: (files: Map<string, GPXFile>) => void) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, callback);

    appendPatches(patch, inversePatch, true);

    return updateFiles(Array.from(newFileState.values()));
}

function applyToFiles(fileIds: string[], callback: (file: GPXFile) => void) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, (draft) => {
        fileIds.forEach((fileId) => {
            callback(draft.get(fileId));
        });
    });

    appendPatches(patch, inversePatch, false);

    return updateFiles(fileIds.map((fileId) => newFileState.get(fileId)));
}

function appendPatches(patch: Patch[], inversePatch: Patch[], global: boolean) {
    db.patches.where('id').above(patchIndex).delete();
    db.patches.add({
        patch,
        inversePatch
    });
    db.settings.put(get(patchIndex) + 1, 'patchIndex');
}

function applyPatch(patch: Patch[]) {
    let newFileState = applyPatches(fileState, patch);
    let changedFiles = [];
    for (let p of patch) {
        let fileId = p.p?.toString();
        if (fileId) {
            let newFile = newFileState.get(fileId);
            if (newFile) {
                changedFiles.push(newFile);
            }
        }
    }
    return updateFiles(changedFiles);
}

function getFileId() {
    for (let index = 0; ; index++) {
        let id = `gpx-${index}`;
        if (!get(fileObservers).has(id)) {
            return id;
        }
    }
}

export function undo() {
    if (get(canUndo)) {
        let index = get(patchIndex);
        applyPatch(get(patches)[index].inversePatch);
        db.settings.put(index - 1, 'patchIndex');
    }
}

export function redo() {
    if (get(canRedo)) {
        let index = get(patchIndex) + 1;
        applyPatch(get(patches)[index].patch);
        db.settings.put(index, 'patchIndex');
    }
}

export const dbUtils = {
    add: (file: GPXFile) => {
        file._data.id = getFileId();
        console.log(file._data.id);
        let result = applyGlobal((draft) => {
            draft.set(file._data.id, file);
        });
        console.log(result);
    },
    addMultiple: (files: GPXFile[]) => {
        applyGlobal((draft) => {
            files.forEach((file) => {
                file._data.id = getFileId();
                draft.set(file._data.id, file);
            });
        });
    },
    applyToFile: (id: string, callback: (file: GPXFile) => void) => {
        applyToFiles([id], callback);
    },
    applyToSelectedFiles: (callback: (file: GPXFile) => void) => {
        applyToFiles(get(fileOrder).filter(fileId => get(selectedFiles).has(fileId)), callback);
    },
    duplicateSelectedFiles: () => {
        applyGlobal((draft) => {
            get(fileOrder).forEach((fileId) => {
                if (get(selectedFiles).has(fileId)) {
                    let file = draft.get(fileId);
                    if (file) {
                        let clone = file.clone();
                        clone._data.id = getFileId();
                        draft.set(clone._data.id, clone);
                    }
                }
            });
        });
    },
    deleteSelectedFiles: () => {
        applyGlobal((draft) => {
            get(selectedFiles).forEach((fileId) => {
                draft.delete(fileId);
            });
        });
    },
    deleteAllFiles: () => {
        applyGlobal((draft) => {
            draft.clear();
        });
    },
}