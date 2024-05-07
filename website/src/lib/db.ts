import Dexie, { liveQuery } from 'dexie';
import { GPXFile } from 'gpx';
import { enableMapSet, enablePatches, produceWithPatches, applyPatches, type Patch } from 'immer';
import { writable, get, derived, type Readable, type Writable } from 'svelte/store';
import { fileOrder, selectedFiles } from './stores';
import { mode } from 'mode-watcher';
import { defaultBasemap, defaultBasemapTree, defaultOverlayTree, defaultOverlays } from './assets/layers';

enableMapSet();
enablePatches();

class Database extends Dexie {

    fileids!: Dexie.Table<string, string>;
    files!: Dexie.Table<GPXFile, string>;
    patches!: Dexie.Table<{ patch: Patch[], inversePatch: Patch[], index: number }, number>;
    settings!: Dexie.Table<any, string>;

    constructor() {
        super("Database", {
            cache: 'immutable'
        });
        this.version(1).stores({
            fileids: ',&fileid',
            files: '',
            patches: ',patch',
            settings: ''
        });
        this.files.add
    }
}

const db = new Database();

// Wrap Dexie live queries in a Svelte store to avoid triggering the query for every subscriber, and updates to the store are pushed to the DB
function dexieSettingStore(setting: string, initial: any): Writable<any> {
    let store = writable(initial);
    liveQuery(() => db.settings.get(setting)).subscribe(value => {
        if (value !== undefined) {
            store.set(value);
        }
    });
    return {
        subscribe: store.subscribe,
        set: (value: any) => db.settings.put(value, setting),
        update: (callback: (value: any) => any) => {
            let newValue = callback(get(store));
            db.settings.put(newValue, setting);
        }
    };
}

// Wrap Dexie live queries in a Svelte store to avoid triggering the query for every subscriber, and updates to the store are pushed to the DB
function dexieUninitializedSettingStore(setting: string, initial: any): Writable<any> {
    let store = writable(undefined);
    liveQuery(() => db.settings.get(setting)).subscribe(value => {
        if (value !== undefined) {
            store.set(value);
        } else {
            store.set(initial);
        }
    });
    return {
        subscribe: store.subscribe,
        set: (value: any) => db.settings.put(value, setting),
        update: (callback: (value: any) => any) => {
            let newValue = callback(get(store));
            db.settings.put(newValue, setting);
        }
    };
}

export const settings = {
    distanceUnits: dexieSettingStore('distanceUnits', 'metric'),
    velocityUnits: dexieSettingStore('velocityUnits', 'speed'),
    temperatureUnits: dexieSettingStore('temperatureUnits', 'celsius'),
    mode: dexieSettingStore('mode', (() => {
        let currentMode: string | undefined = get(mode);
        if (currentMode === undefined) {
            currentMode = 'system';
        }
        return currentMode;
    })()),
    routing: dexieSettingStore('routing', true),
    routingProfile: dexieSettingStore('routingProfile', 'bike'),
    privateRoads: dexieSettingStore('privateRoads', false),
    currentBasemap: dexieSettingStore('currentBasemap', defaultBasemap),
    previousBasemap: dexieSettingStore('previousBasemap', defaultBasemap),
    selectedBasemapTree: dexieSettingStore('selectedBasemapTree', defaultBasemapTree),
    currentOverlays: dexieUninitializedSettingStore('currentOverlays', defaultOverlays),
    previousOverlays: dexieSettingStore('previousOverlays', defaultOverlays),
    selectedOverlayTree: dexieSettingStore('selectedOverlayTree', defaultOverlayTree),
};

// Wrap Dexie live queries in a Svelte store to avoid triggering the query for every subscriber
function dexieStore<T>(querier: () => T | Promise<T>, initial?: T): Readable<T> {
    let store = writable<T>(initial);
    liveQuery(querier).subscribe(value => {
        if (value !== undefined) {
            store.set(value);
        }
    });
    return {
        subscribe: store.subscribe,
    };
}

// Wrap Dexie live queries in a Svelte store to avoid triggering the query for every subscriber, also takes care of the conversion to a GPXFile object
function dexieGPXFileStore(querier: () => GPXFile | undefined | Promise<GPXFile | undefined>): Readable<GPXFile> {
    let store = writable<GPXFile>(undefined);
    liveQuery(querier).subscribe(value => {
        if (value !== undefined) {
            let gpx = new GPXFile(value);
            fileState.set(gpx._data.id, gpx);
            store.set(gpx);
        }
    });
    return {
        subscribe: store.subscribe
    };
}

// Add/update the files to the database
function updateDbFiles(files: (GPXFile | undefined)[], add: boolean = false) {
    let filteredFiles = files.filter(file => file !== undefined) as GPXFile[];
    let fileIds = filteredFiles.map(file => file._data.id);
    if (add) {
        return db.transaction('rw', db.fileids, db.files, async () => {
            await db.fileids.bulkAdd(fileIds, fileIds);
            await db.files.bulkAdd(filteredFiles, fileIds);
        });
    } else {
        return db.files.bulkPut(filteredFiles, fileIds);
    }
}

// Delete the files with the given ids from the database
function deleteDbFiles(fileIds: string[]) {
    return db.transaction('rw', db.fileids, db.files, async () => {
        await db.fileids.bulkDelete(fileIds);
        await db.files.bulkDelete(fileIds);
    });
}

// Commit the changes to the file state to the database
function commitFileStateChange(newFileState: ReadonlyMap<string, GPXFile>, patch: Patch[]) {
    if (newFileState.size > fileState.size) {
        return updateDbFiles(getChangedFileIds(patch).map((fileId) => newFileState.get(fileId)), true);
    } else if (newFileState.size === fileState.size) {
        return updateDbFiles(getChangedFileIds(patch).map((fileId) => newFileState.get(fileId)));
    } else {
        return deleteDbFiles(getChangedFileIds(patch));
    }
}

export const fileObservers: Writable<Map<string, Readable<GPXFile | undefined>>> = writable(new Map());
const fileState: Map<string, GPXFile> = new Map(); // Used to generate patches

// Observe the file ids in the database, and maintain a map of file observers for the corresponding files
liveQuery(() => db.fileids.toArray()).subscribe(dbFileIds => {
    // Find new files to observe
    let newFiles = dbFileIds.filter(id => !get(fileObservers).has(id)).sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
    // Find deleted files to stop observing
    let deletedFiles = Array.from(get(fileObservers).keys()).filter(id => !dbFileIds.find(fileId => fileId === id));
    // Update the store
    if (newFiles.length > 0 || deletedFiles.length > 0) {
        fileObservers.update($files => {
            newFiles.forEach(id => {
                $files.set(id, dexieGPXFileStore(() => db.files.get(id)));
            });
            deletedFiles.forEach(id => {
                $files.delete(id);
                fileState.delete(id);
            });
            return $files;
        });
    }
});

const patchIndex: Readable<number> = dexieStore(() => db.settings.get('patchIndex'), -1);
const patchMinMaxIndex: Readable<{ min: number, max: number }> = dexieStore(() => db.patches.orderBy(':id').keys().then(keys => {
    if (keys.length === 0) {
        return { min: 0, max: 0 };
    } else {
        return { min: keys[0], max: keys[keys.length - 1] + 1 };
    }
}), { min: 0, max: 0 });
export const canUndo: Readable<boolean> = derived([patchIndex, patchMinMaxIndex], ([$patchIndex, $patchMinMaxIndex]) => $patchIndex >= $patchMinMaxIndex.min);
export const canRedo: Readable<boolean> = derived([patchIndex, patchMinMaxIndex], ([$patchIndex, $patchMinMaxIndex]) => $patchIndex < $patchMinMaxIndex.max - 1);

// Helper function to apply a callback to the global file state
function applyGlobal(callback: (files: Map<string, GPXFile>) => void) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, callback);

    storePatches(patch, inversePatch);

    return commitFileStateChange(newFileState, patch);
}

// Helper function to apply a callback to multiple files
function applyToFiles(fileIds: string[], callback: (file: GPXFile) => void) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, (draft) => {
        fileIds.forEach((fileId) => {
            let file = draft.get(fileId);
            if (file) {
                callback(file);
            }
        });
    });

    storePatches(patch, inversePatch);

    return commitFileStateChange(newFileState, patch);
}

const MAX_PATCHES = 100;
// Store the new patches in the database
async function storePatches(patch: Patch[], inversePatch: Patch[]) {
    if (get(patchIndex) !== undefined) {
        db.patches.where(':id').above(get(patchIndex)).delete(); // Delete all patches after the current patch to avoid redoing them
        let minmax = get(patchMinMaxIndex);
        if (minmax.max - minmax.min + 1 > MAX_PATCHES) {
            db.patches.where(':id').belowOrEqual(get(patchMinMaxIndex).max - MAX_PATCHES).delete();
        }
    }
    db.transaction('rw', db.patches, db.settings, async () => {
        let index = get(patchIndex) + 1;
        await db.patches.put({
            patch,
            inversePatch,
            index
        }, index);
        await db.settings.put(index, 'patchIndex');
    });
}

// Apply a patch to the file state
function applyPatch(patch: Patch[]) {
    let newFileState = applyPatches(fileState, patch);
    return commitFileStateChange(newFileState, patch);
}

// Get the file ids of the files that have changed in the patch
function getChangedFileIds(patch: Patch[]): string[] {
    let changedFileIds = new Set();
    for (let p of patch) {
        changedFileIds.add(p.path[0]);
    }
    return Array.from(changedFileIds);
}

// Generate unique file ids, different from the ones in the database
function getFileIds(n: number) {
    let ids = [];
    for (let index = 0; ids.length < n; index++) {
        let id = `gpx-${index}`;
        if (!get(fileObservers).has(id)) {
            ids.push(id);
        }
    }
    return ids;
}

// Helper functions for file operations
export const dbUtils = {
    add: (file: GPXFile) => {
        file._data.id = getFileIds(1)[0];
        return applyGlobal((draft) => {
            draft.set(file._data.id, file);
        });
    },
    addMultiple: (files: GPXFile[]) => {
        return applyGlobal((draft) => {
            let ids = getFileIds(files.length);
            files.forEach((file, index) => {
                file._data.id = ids[index];
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
            let ids = getFileIds(get(fileOrder).length);
            get(fileOrder).forEach((fileId, index) => {
                if (get(selectedFiles).has(fileId)) {
                    let file = draft.get(fileId);
                    if (file) {
                        let clone = file.clone();
                        clone._data.id = ids[index];
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
    // undo-redo
    undo: () => {
        if (get(canUndo)) {
            let index = get(patchIndex);
            db.patches.get(index).then(patch => {
                if (patch) {
                    applyPatch(patch.inversePatch);
                    db.settings.put(index - 1, 'patchIndex');
                }
            });
        }
    },
    redo: () => {
        if (get(canRedo)) {
            let index = get(patchIndex) + 1;
            db.patches.get(index).then(patch => {
                if (patch) {
                    applyPatch(patch.patch);
                    db.settings.put(index, 'patchIndex');
                }
            });
        }
    }
}