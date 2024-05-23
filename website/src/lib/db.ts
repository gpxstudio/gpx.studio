import Dexie, { liveQuery } from 'dexie';
import { GPXFile, GPXStatistics, Track } from 'gpx';
import { enableMapSet, enablePatches, applyPatches, type Patch, type WritableDraft, castDraft, Immer } from 'immer';
import { writable, get, derived, type Readable, type Writable } from 'svelte/store';
import { initTargetMapBounds, updateTargetMapBounds } from './stores';
import { mode } from 'mode-watcher';
import { defaultBasemap, defaultBasemapTree, defaultOverlayTree, defaultOverlays } from './assets/layers';
import { selection } from '$lib/components/file-list/Selection';
import { ListFileItem, ListItem, type ListLevel } from '$lib/components/file-list/FileList';

enableMapSet();
enablePatches();

const noFreezeImmer = new Immer({ autoFreeze: false }); // Do not freeze files that are not concerned by an update, otherwise cannot assign anchors for them

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
function dexieSettingStore<T>(setting: string, initial: T): Writable<T> {
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
    distanceUnits: dexieSettingStore<'metric' | 'imperial'>('distanceUnits', 'metric'),
    velocityUnits: dexieSettingStore('velocityUnits', 'speed'),
    temperatureUnits: dexieSettingStore('temperatureUnits', 'celsius'),
    verticalFileView: dexieSettingStore<boolean>('fileView', false),
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
    directionMarkers: dexieSettingStore('directionMarkers', false),
    distanceMarkers: dexieSettingStore('distanceMarkers', false),
    fileOrder: dexieSettingStore<string[]>('fileOrder', []),
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

export class GPXStatisticsTree {
    level: ListLevel;
    statistics: {
        [key: number]: GPXStatisticsTree | GPXStatistics;
    } = {};

    constructor(element: GPXFile | Track) {
        if (element instanceof GPXFile) {
            this.level = 'file';
            element.children.forEach((child, index) => {
                this.statistics[index] = new GPXStatisticsTree(child);
            });
        } else {
            this.level = 'track';
            element.children.forEach((child, index) => {
                this.statistics[index] = child.getStatistics();
            });
        }
    }

    getStatisticsFor(item: ListItem): GPXStatistics {
        let statistics = new GPXStatistics();
        let id = item.getIdAtLevel(this.level);
        if (id === undefined || id === 'waypoints') {
            Object.keys(this.statistics).forEach(key => {
                if (this.statistics[key] instanceof GPXStatistics) {
                    statistics.mergeWith(this.statistics[key]);
                } else {
                    statistics.mergeWith(this.statistics[key].getStatisticsFor(item));
                }
            });
        } else {
            let child = this.statistics[id];
            if (child instanceof GPXStatistics) {
                statistics.mergeWith(child);
            } else if (child !== undefined) {
                statistics.mergeWith(child.getStatisticsFor(item));
            }
        }
        return statistics;
    }
};
export type GPXFileWithStatistics = { file: GPXFile, statistics: GPXStatisticsTree };

// Wrap Dexie live queries in a Svelte store to avoid triggering the query for every subscriber, also takes care of the conversion to a GPXFile object
function dexieGPXFileStore(id: string): Readable<GPXFileWithStatistics> & { destroy: () => void } {
    let store = writable<GPXFileWithStatistics>(undefined);
    let query = liveQuery(() => db.files.get(id)).subscribe(value => {
        if (value !== undefined) {
            let gpx = new GPXFile(value);

            let statistics = new GPXStatisticsTree(gpx);
            if (!fileState.has(id)) { // Update the map bounds for new files
                updateTargetMapBounds(statistics.getStatisticsFor(new ListFileItem(id)).global.bounds);
            }

            fileState.set(id, gpx);
            store.set({
                file: gpx,
                statistics
            });
        }
    });
    return {
        subscribe: store.subscribe,
        destroy: () => {
            fileState.delete(id);
            query.unsubscribe();
        }
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

export const fileObservers: Writable<Map<string, Readable<GPXFileWithStatistics | undefined> & { destroy: () => void }>> = writable(new Map());
const fileState: Map<string, GPXFile> = new Map(); // Used to generate patches

// Observe the file ids in the database, and maintain a map of file observers for the corresponding files
liveQuery(() => db.fileids.toArray()).subscribe(dbFileIds => {
    // Find new files to observe
    let newFiles = dbFileIds.filter(id => !get(fileObservers).has(id)).sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
    // Find deleted files to stop observing
    let deletedFiles = Array.from(get(fileObservers).keys()).filter(id => !dbFileIds.find(fileId => fileId === id));

    if (newFiles.length > 0) { // Reset the target map bounds when new files are added
        initTargetMapBounds(fileState.size === 0);
    }

    // Update the store
    if (newFiles.length > 0 || deletedFiles.length > 0) {
        fileObservers.update($files => {
            newFiles.forEach(id => {
                $files.set(id, dexieGPXFileStore(id));
            });
            deletedFiles.forEach(id => {
                $files.get(id)?.destroy();
                $files.delete(id);
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
    const [newFileState, patch, inversePatch] = noFreezeImmer.produceWithPatches(fileState, callback);

    storePatches(patch, inversePatch);

    return commitFileStateChange(newFileState, patch);
}

// Helper function to apply a callback to multiple files
function applyToFiles(fileIds: string[], callback: (file: WritableDraft<GPXFile>) => GPXFile) {
    const [newFileState, patch, inversePatch] = noFreezeImmer.produceWithPatches(fileState, (draft) => {
        fileIds.forEach((fileId) => {
            let file = draft.get(fileId);
            if (file) {
                draft.set(fileId, castDraft(callback(file)));
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
    let changedFileIds = new Set<string>();
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
    applyToFile: (id: string, callback: (file: WritableDraft<GPXFile>) => GPXFile) => {
        applyToFiles([id], callback);
    },
    applyToSelection: (callback: (file: WritableDraft<GPXFile>) => GPXFile) => {
        // TODO
        applyToFiles(get(selection).forEach(fileId), callback);
    },
    duplicateSelection: () => {
        applyGlobal((draft) => {
            // TODO
            let ids = getFileIds(get(settings.fileOrder).length);
            get(settings.fileOrder).forEach((fileId, index) => {
                if (get(selection).has(fileId)) {
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
    deleteSelection: () => {
        applyGlobal((draft) => {
            selection.update(($selection) => {
                $selection.forEach((item) => {
                    if (item instanceof ListFileItem) {
                        draft.delete(item.getId());
                    }
                    // TODO: Implement deletion of tracks, segments, waypoints
                });
                $selection.clear();
                return $selection;
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