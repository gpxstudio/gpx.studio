import Dexie, { liveQuery } from 'dexie';
import { GPXFile, GPXStatistics, Track, type AnyGPXTreeElement } from 'gpx';
import { enableMapSet, enablePatches, applyPatches, type Patch, type WritableDraft, castDraft, freeze, produceWithPatches, original, produce } from 'immer';
import { writable, get, derived, type Readable, type Writable } from 'svelte/store';
import { initTargetMapBounds, updateTargetMapBounds } from './stores';
import { mode } from 'mode-watcher';
import { defaultBasemap, defaultBasemapTree, defaultOverlayTree, defaultOverlays } from './assets/layers';
import { applyToOrderedSelectedItemsFromFile, selection } from '$lib/components/file-list/Selection';
import { ListFileItem, ListItem, ListTrackItem, ListLevel, ListTrackSegmentItem, ListWaypointItem, ListRootItem } from '$lib/components/file-list/FileList';
import { updateAnchorPoints } from '$lib/components/toolbar/tools/routing/Simplify';

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
    stravaHeatmapColor: dexieSettingStore('stravaHeatmapColor', 'bluered'),
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
            this.level = ListLevel.FILE;
            element.children.forEach((child, index) => {
                this.statistics[index] = new GPXStatisticsTree(child);
            });
        } else {
            this.level = ListLevel.TRACK;
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
            updateAnchorPoints(gpx);

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
function updateDbFiles(files: (GPXFile | undefined)[]) {
    let filteredFiles = files.filter(file => file !== undefined) as GPXFile[];
    let fileIds = filteredFiles.map(file => file._data.id);
    return db.transaction('rw', db.fileids, db.files, async () => {
        await db.fileids.bulkPut(fileIds, fileIds);
        await db.files.bulkPut(filteredFiles, fileIds);
    });
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
    if (newFileState.size >= fileState.size) {
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

    // Update the store
    if (newFiles.length > 0 || deletedFiles.length > 0) {
        fileObservers.update($files => {
            if (newFiles.length > 0) { // Reset the target map bounds when new files are added
                initTargetMapBounds($files.size === 0);
            }
            newFiles.forEach(id => {
                $files.set(id, dexieGPXFileStore(id));
            });
            deletedFiles.forEach(id => {
                $files.get(id)?.destroy();
                $files.delete(id);
            });
            return $files;
        });
        if (deletedFiles.length > 0) {
            selection.update(($selection) => {
                deletedFiles.forEach((fileId) => {
                    $selection.deleteChild(fileId);
                });
                return $selection;
            });
        }
        settings.fileOrder.update((order) => {
            newFiles.forEach((fileId) => {
                if (!order.includes(fileId)) {
                    order.push(fileId);
                }
            });
            deletedFiles.forEach((fileId) => {
                let index = order.indexOf(fileId);
                if (index !== -1) {
                    order.splice(index, 1);
                }
            });
            return order;
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
function applyToFiles(fileIds: string[], callback: (file: WritableDraft<GPXFile>) => GPXFile) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, (draft) => {
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

// Helper function to apply different callbacks to multiple files
function applyEachToFilesAndGlobal(fileIds: string[], callbacks: ((file: WritableDraft<GPXFile>, context?: any) => GPXFile)[], globalCallback: (files: Map<string, GPXFile>, context?: any) => void, context?: any) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, (draft) => {
        fileIds.forEach((fileId, index) => {
            let file = draft.get(fileId);
            if (file) {
                draft.set(fileId, castDraft(callbacks[index](file, context)));
            }
        });
        globalCallback(draft, context);
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
export function getFileIds(n: number) {
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
            draft.set(file._data.id, freeze(file));
        });
    },
    addMultiple: (files: GPXFile[]) => {
        return applyGlobal((draft) => {
            let ids = getFileIds(files.length);
            files.forEach((file, index) => {
                file._data.id = ids[index];
                draft.set(file._data.id, freeze(file));
            });
        });
    },
    applyToFile: (id: string, callback: (file: WritableDraft<GPXFile>) => GPXFile) => {
        applyToFiles([id], callback);
    },
    applyToFiles: (ids: string[], callback: (file: WritableDraft<GPXFile>) => GPXFile) => {
        applyToFiles(ids, callback);
    },
    applyEachToFilesAndGlobal: (ids: string[], callbacks: ((file: WritableDraft<GPXFile>, context?: any) => GPXFile)[], globalCallback: (files: Map<string, GPXFile>, context?: any) => void, context?: any) => {
        applyEachToFilesAndGlobal(ids, callbacks, globalCallback, context);
    },
    applyToSelection: (callback: (file: WritableDraft<AnyGPXTreeElement>) => AnyGPXTreeElement) => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    for (let item of items) {
                        if (item instanceof ListFileItem) {
                            callback(castDraft(file));
                        } else if (item instanceof ListTrackItem) {
                            let trackIndex = item.getTrackIndex();
                            file = produce(file, (fileDraft) => {
                                callback(fileDraft.trk[trackIndex]);
                            });
                        } else if (item instanceof ListTrackSegmentItem) {
                            let trackIndex = item.getTrackIndex();
                            let segmentIndex = item.getSegmentIndex();
                            file = produce(file, (fileDraft) => {
                                callback(fileDraft.trk[trackIndex].trkseg[segmentIndex]);
                            });
                        }
                    }
                    draft.set(fileId, freeze(file));
                }
            });
        });
    },
    duplicateSelection: () => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            let ids = getFileIds(get(settings.fileOrder).length);
            let index = 0;
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = original(draft)?.get(fileId);
                if (file) {
                    let newFile = file;
                    if (level === ListLevel.FILE) {
                        newFile = file.clone();
                        newFile._data.id = ids[index++];
                    } else if (level === ListLevel.TRACK) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            let [result, _removed] = newFile.replaceTracks(trackIndex + 1, trackIndex, [file.trk[trackIndex].clone()]);
                            newFile = result;
                        }
                    } else if (level === ListLevel.SEGMENT) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                            let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                            let [result, _removed] = newFile.replaceTrackSegments(trackIndex, segmentIndex + 1, segmentIndex, [file.trk[trackIndex].trkseg[segmentIndex].clone()]);
                            newFile = result;
                        }
                    } else if (level === ListLevel.WAYPOINT) {
                        for (let item of items) {
                            let waypointIndex = (item as ListWaypointItem).getWaypointIndex();
                            let [result, _removed] = newFile.replaceWaypoints(waypointIndex + 1, waypointIndex, [file.wpt[waypointIndex].clone()]);
                            newFile = result;
                        }
                    }
                    draft.set(newFile._data.id, freeze(newFile));
                }
            });
        });
    },
    reverseSelection: () => {
        if (!get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints'])) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = original(draft)?.get(fileId);
                if (file) {
                    let newFile = file;
                    if (level === ListLevel.FILE) {
                        newFile = file.reverse();
                    } else if (level === ListLevel.TRACK) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            newFile = newFile.reverseTrack(trackIndex);
                        }
                    } else if (level === ListLevel.SEGMENT) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                            let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                            newFile = newFile.reverseTrackSegment(trackIndex, segmentIndex);
                        }
                    }
                    draft.set(newFile._data.id, freeze(newFile));
                }
            });
        });
    },
    deleteSelection: () => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                if (level === ListLevel.FILE) {
                    draft.delete(fileId);
                } else {
                    let file = original(draft)?.get(fileId);
                    if (file) {
                        let newFile = file;
                        if (level === ListLevel.TRACK) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                let [result, _removed] = newFile.replaceTracks(trackIndex, trackIndex, []);
                                newFile = result;
                            }
                        } else if (level === ListLevel.SEGMENT) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                let [result, _removed] = newFile.replaceTrackSegments(trackIndex, segmentIndex, segmentIndex, []);
                                newFile = result;
                            }
                        } else if (level === ListLevel.WAYPOINTS) {
                            let [result, _removed] = newFile.replaceWaypoints(0, newFile.wpt.length - 1, []);
                            newFile = result;
                        } else if (level === ListLevel.WAYPOINT) {
                            for (let item of items) {
                                let waypointIndex = (item as ListWaypointItem).getWaypointIndex();
                                let [result, _removed] = newFile.replaceWaypoints(waypointIndex, waypointIndex, []);
                                newFile = result;
                            }
                        }
                        draft.set(newFile._data.id, freeze(newFile));
                    }
                }
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