import Dexie, { liveQuery } from 'dexie';
import { GPXFile, GPXStatistics, Track, TrackSegment, Waypoint, TrackPoint, type Coordinates, distance, type LineStyleExtension, type WaypointType } from 'gpx';
import { enableMapSet, enablePatches, applyPatches, type Patch, type WritableDraft, freeze, produceWithPatches } from 'immer';
import { writable, get, derived, type Readable, type Writable } from 'svelte/store';
import { gpxStatistics, initTargetMapBounds, map, splitAs, updateAllHidden, updateTargetMapBounds } from './stores';
import { defaultBasemap, defaultBasemapTree, defaultOverlayTree, defaultOverlays, type CustomLayer, defaultOpacities, defaultOverpassQueries, defaultOverpassTree } from './assets/layers';
import { applyToOrderedItemsFromFile, applyToOrderedSelectedItemsFromFile, selection } from '$lib/components/file-list/Selection';
import { ListFileItem, ListItem, ListTrackItem, ListLevel, ListTrackSegmentItem, ListWaypointItem, ListRootItem } from '$lib/components/file-list/FileList';
import { updateAnchorPoints } from '$lib/components/toolbar/tools/routing/Simplify';
import { SplitType } from '$lib/components/toolbar/tools/scissors/Scissors.svelte';
import { getClosestLinePoint, getElevation } from '$lib/utils';
import { browser } from '$app/environment';

enableMapSet();
enablePatches();

class Database extends Dexie {

    fileids!: Dexie.Table<string, string>;
    files!: Dexie.Table<GPXFile, string>;
    patches!: Dexie.Table<{ patch: Patch[], inversePatch: Patch[], index: number }, number>;
    settings!: Dexie.Table<any, string>;
    overpasstiles!: Dexie.Table<{ query: string, x: number, y: number, time: number }, [string, number, number]>;
    overpassdata!: Dexie.Table<{ query: string, id: number, poi: GeoJSON.Feature }, [string, number]>;

    constructor() {
        super("Database", {
            cache: 'immutable'
        });
        this.version(1).stores({
            fileids: ',&fileid',
            files: '',
            patches: ',patch',
            settings: '',
            overpasstiles: '[query+x+y],[x+y]',
            overpassdata: '[query+id]',
        });
    }
}

export const db = new Database();

// Wrap Dexie live queries in a Svelte store to avoid triggering the query for every subscriber, and updates to the store are pushed to the DB
export function bidirectionalDexieStore<K, V>(table: Dexie.Table<V, K>, key: K, initial: V, initialize: boolean = true): Writable<V | undefined> {
    let first = true;
    let store = writable<V | undefined>(initialize ? initial : undefined);
    liveQuery(() => table.get(key)).subscribe(value => {
        if (value === undefined) {
            if (first) {
                if (!initialize) {
                    store.set(initial);
                }
            } else {
                store.set(value);
            }
        } else {
            store.set(value);
        }
        first = false;
    });
    return {
        subscribe: store.subscribe,
        set: (value: any) => {
            if (typeof value === 'object' || value !== get(store)) {
                table.put(value, key);
            }
        },
        update: (callback: (value: any) => any) => {
            let newValue = callback(get(store));
            if (typeof newValue === 'object' || newValue !== get(store)) {
                table.put(newValue, key);
            }
        }
    };
}

export function dexieSettingStore<T>(key: string, initial: T, initialize: boolean = true): Writable<T> {
    return bidirectionalDexieStore(db.settings, key, initial, initialize);
}

export const settings = {
    distanceUnits: dexieSettingStore<'metric' | 'imperial' | 'nautical'>('distanceUnits', 'metric'),
    velocityUnits: dexieSettingStore<'speed' | 'pace'>('velocityUnits', 'speed'),
    temperatureUnits: dexieSettingStore<'celsius' | 'fahrenheit'>('temperatureUnits', 'celsius'),
    elevationProfile: dexieSettingStore('elevationProfile', true),
    additionalDatasets: dexieSettingStore<string[]>('additionalDatasets', []),
    elevationFill: dexieSettingStore<'slope' | 'surface' | undefined>('elevationFill', undefined),
    treeFileView: dexieSettingStore<boolean>('fileView', false),
    minimizeRoutingMenu: dexieSettingStore('minimizeRoutingMenu', false),
    routing: dexieSettingStore('routing', true),
    routingProfile: dexieSettingStore('routingProfile', 'bike'),
    privateRoads: dexieSettingStore('privateRoads', false),
    currentBasemap: dexieSettingStore('currentBasemap', defaultBasemap),
    previousBasemap: dexieSettingStore('previousBasemap', defaultBasemap),
    selectedBasemapTree: dexieSettingStore('selectedBasemapTree', defaultBasemapTree),
    currentOverlays: dexieSettingStore('currentOverlays', defaultOverlays, false),
    previousOverlays: dexieSettingStore('previousOverlays', defaultOverlays),
    selectedOverlayTree: dexieSettingStore('selectedOverlayTree', defaultOverlayTree),
    currentOverpassQueries: dexieSettingStore('currentOverpassQueries', defaultOverpassQueries, false),
    selectedOverpassTree: dexieSettingStore('selectedOverpassTree', defaultOverpassTree),
    opacities: dexieSettingStore('opacities', defaultOpacities),
    customLayers: dexieSettingStore<Record<string, CustomLayer>>('customLayers', {}),
    customBasemapOrder: dexieSettingStore<string[]>('customBasemapOrder', []),
    customOverlayOrder: dexieSettingStore<string[]>('customOverlayOrder', []),
    directionMarkers: dexieSettingStore('directionMarkers', false),
    distanceMarkers: dexieSettingStore('distanceMarkers', false),
    streetViewSource: dexieSettingStore('streetViewSource', 'mapillary'),
    fileOrder: dexieSettingStore<string[]>('fileOrder', []),
    defaultOpacity: dexieSettingStore('defaultOpacity', 0.7),
    defaultWidth: dexieSettingStore('defaultWidth', (browser && window.innerWidth < 600) ? 8 : 5),
    bottomPanelSize: dexieSettingStore('bottomPanelSize', 170),
    rightPanelSize: dexieSettingStore('rightPanelSize', 240),
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
                updateTargetMapBounds(id, statistics.getStatisticsFor(new ListFileItem(id)).global.bounds);
            }

            fileState.set(id, gpx);
            store.set({
                file: gpx,
                statistics
            });

            if (get(selection).hasAnyChildren(new ListFileItem(id))) {
                updateAllHidden();
            }
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

function updateSelection(updatedFiles: GPXFile[], deletedFileIds: string[]) {
    let removedItems: ListItem[] = [];

    applyToOrderedItemsFromFile(get(selection).getSelected(), (fileId, level, items) => {
        let file = updatedFiles.find((file) => file._data.id === fileId);
        if (file) {
            items.forEach((item) => {
                if (item instanceof ListTrackItem) {
                    let newTrackIndex = file.trk.findIndex((track) => track._data.trackIndex === item.getTrackIndex());
                    if (newTrackIndex === -1) {
                        removedItems.push(item);
                    }
                } else if (item instanceof ListTrackSegmentItem) {
                    let newTrackIndex = file.trk.findIndex((track) => track._data.trackIndex === item.getTrackIndex());
                    if (newTrackIndex === -1) {
                        removedItems.push(item);
                    } else {
                        let newSegmentIndex = file.trk[newTrackIndex].trkseg.findIndex((segment) => segment._data.segmentIndex === item.getSegmentIndex());
                        if (newSegmentIndex === -1) {
                            removedItems.push(item);
                        }
                    }
                } else if (item instanceof ListWaypointItem) {
                    let newWaypointIndex = file.wpt.findIndex((wpt) => wpt._data.index === item.getWaypointIndex());
                    if (newWaypointIndex === -1) {
                        removedItems.push(item);
                    }
                }
            });
        } else if (deletedFileIds.includes(fileId)) {
            items.forEach((item) => {
                removedItems.push(item);
            });
        }
    });

    if (removedItems.length > 0) {
        selection.update(($selection) => {
            removedItems.forEach((item) => {
                if (item instanceof ListFileItem) {
                    $selection.deleteChild(item.getFileId());
                } else {
                    $selection.set(item, false);
                }
            });
            return $selection;
        });
    }
}

// Commit the changes to the file state to the database
function commitFileStateChange(newFileState: ReadonlyMap<string, GPXFile>, patch: Patch[]) {
    let changedFileIds = getChangedFileIds(patch);
    let updatedFileIds: string[] = [], deletedFileIds: string[] = [];

    changedFileIds.forEach(id => {
        if (newFileState.has(id)) {
            updatedFileIds.push(id);
        } else {
            deletedFileIds.push(id);
        }
    });

    let updatedFiles = updatedFileIds.map(id => newFileState.get(id)).filter(file => file !== undefined) as GPXFile[];
    updatedFileIds = updatedFiles.map(file => file._data.id);

    updateSelection(updatedFiles, deletedFileIds);

    return db.transaction('rw', db.fileids, db.files, async () => {
        if (updatedFileIds.length > 0) {
            await db.fileids.bulkPut(updatedFileIds, updatedFileIds);
            await db.files.bulkPut(updatedFiles, updatedFileIds);
        }
        if (deletedFileIds.length > 0) {
            await db.fileids.bulkDelete(deletedFileIds);
            await db.files.bulkDelete(deletedFileIds);
        }
    });
}

export const fileObservers: Writable<Map<string, Readable<GPXFileWithStatistics | undefined> & { destroy?: () => void }>> = writable(new Map());
const fileState: Map<string, GPXFile> = new Map(); // Used to generate patches

// Observe the file ids in the database, and maintain a map of file observers for the corresponding files
export function observeFilesFromDatabase(fitBounds: boolean) {
    let initialize = true;
    liveQuery(() => db.fileids.toArray()).subscribe(dbFileIds => {
        if (initialize) {
            if (fitBounds && dbFileIds.length > 0) {
                initTargetMapBounds(dbFileIds);
            }
            initialize = false;
        }
        // Find new files to observe
        let newFiles = dbFileIds.filter(id => !get(fileObservers).has(id)).sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
        // Find deleted files to stop observing
        let deletedFiles = Array.from(get(fileObservers).keys()).filter(id => !dbFileIds.find(fileId => fileId === id));

        // Update the store
        if (newFiles.length > 0 || deletedFiles.length > 0) {
            fileObservers.update($files => {
                newFiles.forEach(id => {
                    $files.set(id, dexieGPXFileStore(id));
                });
                deletedFiles.forEach(id => {
                    $files.get(id)?.destroy?.();
                    $files.delete(id);
                });
                return $files;
            });
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
}

export function getFile(fileId: string): GPXFile | undefined {
    let fileStore = get(fileObservers).get(fileId);
    return fileStore ? get(fileStore)?.file : undefined;
}

export function getStatistics(fileId: string): GPXStatisticsTree | undefined {
    let fileStore = get(fileObservers).get(fileId);
    return fileStore ? get(fileStore)?.statistics : undefined;
}

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
function applyToFiles(fileIds: string[], callback: (file: WritableDraft<GPXFile>) => void) {
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

// Helper function to apply different callbacks to multiple files
function applyEachToFilesAndGlobal(fileIds: string[], callbacks: ((file: WritableDraft<GPXFile>, context?: any) => void)[], globalCallback: (files: Map<string, GPXFile>, context?: any) => void, context?: any) {
    const [newFileState, patch, inversePatch] = produceWithPatches(fileState, (draft) => {
        fileIds.forEach((fileId, index) => {
            let file = draft.get(fileId);
            if (file) {
                callbacks[index](file, context);
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
        if (file._data.id === undefined) {
            file._data.id = getFileIds(1)[0];
        }
        return applyGlobal((draft) => {
            draft.set(file._data.id, freeze(file));
        });
    },
    addMultiple: (files: GPXFile[]) => {
        let ids = getFileIds(files.length);
        applyGlobal((draft) => {
            files.forEach((file, index) => {
                file._data.id = ids[index];
                draft.set(file._data.id, freeze(file));
            });
        });
        return ids;
    },
    applyToFile: (id: string, callback: (file: WritableDraft<GPXFile>) => void) => {
        applyToFiles([id], callback);
    },
    applyToFiles: (ids: string[], callback: (file: WritableDraft<GPXFile>) => void) => {
        applyToFiles(ids, callback);
    },
    applyEachToFilesAndGlobal: (ids: string[], callbacks: ((file: WritableDraft<GPXFile>, context?: any) => void)[], globalCallback: (files: Map<string, GPXFile>, context?: any) => void, context?: any) => {
        applyEachToFilesAndGlobal(ids, callbacks, globalCallback, context);
    },
    duplicateSelection: () => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            let ids = getFileIds(get(settings.fileOrder).length);
            let index = 0;
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                if (level === ListLevel.FILE) {
                    let file = getFile(fileId);
                    if (file) {
                        let newFile = file.clone();
                        newFile._data.id = ids[index++];
                        draft.set(newFile._data.id, freeze(newFile));
                    }
                } else {
                    let file = draft.get(fileId);
                    if (file) {
                        if (level === ListLevel.TRACK) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                file.replaceTracks(trackIndex + 1, trackIndex, [file.trk[trackIndex].clone()]);
                            }
                        } else if (level === ListLevel.SEGMENT) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                file.replaceTrackSegments(trackIndex, segmentIndex + 1, segmentIndex, [file.trk[trackIndex].trkseg[segmentIndex].clone()]);
                            }
                        } else if (level === ListLevel.WAYPOINTS) {
                            file.replaceWaypoints(file.wpt.length, file.wpt.length - 1, file.wpt.map((wpt) => wpt.clone()));
                        } else if (level === ListLevel.WAYPOINT) {
                            for (let item of items) {
                                let waypointIndex = (item as ListWaypointItem).getWaypointIndex();
                                file.replaceWaypoints(waypointIndex + 1, waypointIndex, [file.wpt[waypointIndex].clone()]);
                            }
                        }
                    }
                }
            });
        });
    },
    addNewTrack: (fileId: string) => {
        dbUtils.applyToFile(fileId, (file) => file.replaceTracks(file.trk.length, file.trk.length, [new Track()]));
    },
    addNewSegment: (fileId: string, trackIndex: number) => {
        dbUtils.applyToFile(fileId, (file) => {
            let track = file.trk[trackIndex];
            track.replaceTrackSegments(track.trkseg.length, track.trkseg.length, [new TrackSegment()]);
        });
    },
    reverseSelection: () => {
        if (!get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints']) || get(gpxStatistics).local.points?.length <= 1) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.reverse();
                    } else if (level === ListLevel.TRACK) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            file.reverseTrack(trackIndex);
                        }
                    } else if (level === ListLevel.SEGMENT) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                            let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                            file.reverseTrackSegment(trackIndex, segmentIndex);
                        }
                    }
                }
            });
        });
    },
    createRoundTripForSelection() {
        if (!get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints'])) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.roundTrip();
                    } else if (level === ListLevel.TRACK) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            file.roundTripTrack(trackIndex);
                        }
                    } else if (level === ListLevel.SEGMENT) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                            let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                            file.roundTripTrackSegment(trackIndex, segmentIndex);
                        }
                    }
                }
            });
        });
    },
    mergeSelection: (mergeTraces: boolean, removeGaps: boolean) => {
        applyGlobal((draft) => {
            let first = true;
            let target: ListItem = new ListRootItem();
            let targetFile: GPXFile | undefined = undefined;
            let toMerge: {
                trk: Track[],
                trkseg: TrackSegment[],
                wpt: Waypoint[]
            } = {
                trk: [],
                trkseg: [],
                wpt: []
            };
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                let originalFile = getFile(fileId);
                if (file && originalFile) {
                    if (level === ListLevel.FILE) {
                        toMerge.trk.push(...originalFile.trk.map((track) => track.clone()));
                        for (const wpt of originalFile.wpt) {
                            if (!toMerge.wpt.some((w) => w.equals(wpt))) {
                                toMerge.wpt.push(wpt.clone());
                            }
                        }
                        if (first) {
                            target = items[0];
                            targetFile = file;
                        } else {
                            draft.delete(fileId);
                        }
                    } else {
                        if (level === ListLevel.TRACK) {
                            items.forEach((item, index) => {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                toMerge.trkseg.splice(0, 0, ...originalFile.trk[trackIndex].trkseg.map((segment) => segment.clone()));
                                if (index === items.length - 1) { // Order is reversed, so the last track is the first one and the one to keep
                                    target = item;
                                    file.trk[trackIndex].trkseg = [];
                                } else {
                                    file.trk.splice(trackIndex, 1);
                                }
                            });
                        } else if (level === ListLevel.SEGMENT) {
                            items.forEach((item, index) => {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                if (index === items.length - 1) { // Order is reversed, so the last segment is the first one and the one to keep
                                    target = item;
                                }
                                toMerge.trkseg.splice(0, 0, originalFile.trk[trackIndex].trkseg[segmentIndex].clone());
                                file.trk[trackIndex].trkseg.splice(segmentIndex, 1);
                            });
                        }
                        targetFile = file;
                    }
                    first = false;
                }
            });

            if (mergeTraces) {
                let statistics = get(gpxStatistics);
                let speed = statistics.global.speed.moving > 0 ? statistics.global.speed.moving : undefined;
                let startTime: Date | undefined = undefined;
                if (speed !== undefined) {
                    if (statistics.local.points.length > 0 && statistics.local.points[0].time !== undefined) {
                        startTime = statistics.local.points[0].time;
                    } else {
                        let index = statistics.local.points.findIndex((point) => point.time !== undefined);
                        if (index !== -1) {
                            startTime = new Date(statistics.local.points[index].time.getTime() - 1000 * 3600 * statistics.local.distance.total[index] / speed);
                        }
                    }
                }

                if (toMerge.trk.length > 0 && toMerge.trk[0].trkseg.length > 0) {
                    let s = new TrackSegment();
                    toMerge.trk.map((track) => {
                        track.trkseg.forEach((segment) => {
                            s.replaceTrackPoints(s.trkpt.length, s.trkpt.length, segment.trkpt.slice(), speed, startTime, removeGaps);
                        });
                    });
                    toMerge.trk = [toMerge.trk[0]];
                    toMerge.trk[0].trkseg = [s];
                }
                if (toMerge.trkseg.length > 0) {
                    let s = new TrackSegment();
                    toMerge.trkseg.forEach((segment) => {
                        s.replaceTrackPoints(s.trkpt.length, s.trkpt.length, segment.trkpt.slice(), speed, startTime, removeGaps);
                    });
                    toMerge.trkseg = [s];
                }
            }

            if (targetFile) {
                if (target instanceof ListFileItem) {
                    targetFile.replaceTracks(0, targetFile.trk.length - 1, toMerge.trk);
                    targetFile.replaceWaypoints(0, targetFile.wpt.length - 1, toMerge.wpt);
                } else if (target instanceof ListTrackItem) {
                    let trackIndex = target.getTrackIndex();
                    targetFile.replaceTrackSegments(trackIndex, 0, -1, toMerge.trkseg);
                } else if (target instanceof ListTrackSegmentItem) {
                    let trackIndex = target.getTrackIndex();
                    let segmentIndex = target.getSegmentIndex();
                    targetFile.replaceTrackSegments(trackIndex, segmentIndex, segmentIndex - 1, toMerge.trkseg);
                }
            }
        });
    },
    cropSelection: (start: number, end: number) => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        let length = file.getNumberOfTrackPoints();
                        if (start >= length || end < 0) {
                            draft.delete(fileId);
                        } else if (start > 0 || end < length - 1) {
                            file.crop(Math.max(0, start), Math.min(length - 1, end));
                        }
                        start -= length;
                        end -= length;
                    } else if (level === ListLevel.TRACK) {
                        let trackIndices = items.map((item) => (item as ListTrackItem).getTrackIndex());
                        file.crop(start, end, trackIndices);
                    } else if (level === ListLevel.SEGMENT) {
                        let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                        let segmentIndices = items.map((item) => (item as ListTrackSegmentItem).getSegmentIndex());
                        file.crop(start, end, trackIndices, segmentIndices);
                    }
                }
            }, false);
        });
    },
    extractSelection: () => {
        return applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                if (level === ListLevel.FILE) {
                    let file = getFile(fileId);
                    if (file) {
                        if (file.trk.length > 1) {
                            let fileIds = getFileIds(file.trk.length);

                            let closest = file.wpt.map((wpt, wptIndex) => {
                                return {
                                    wptIndex: wptIndex,
                                    index: [0],
                                    distance: Number.MAX_VALUE
                                };
                            })
                            file.trk.forEach((track, index) => {
                                track.getSegments().forEach((segment) => {
                                    segment.trkpt.forEach((point) => {
                                        file.wpt.forEach((wpt, wptIndex) => {
                                            let dist = distance(point.getCoordinates(), wpt.getCoordinates());
                                            if (dist < closest[wptIndex].distance) {
                                                closest[wptIndex].distance = dist;
                                                closest[wptIndex].index = [index];
                                            } else if (dist === closest[wptIndex].distance) {
                                                closest[wptIndex].index.push(index);
                                            }
                                        });
                                    })
                                });
                            });

                            file.trk.forEach((track, index) => {
                                let newFile = file.clone();
                                let tracks = track.trkseg.map((segment, segmentIndex) => {
                                    let t = track.clone();
                                    t.replaceTrackSegments(0, track.trkseg.length - 1, [segment]);
                                    if (track.name) {
                                        t.name = `${track.name} (${segmentIndex + 1})`;
                                    }
                                    return t;
                                });
                                newFile.replaceTracks(0, file.trk.length - 1, tracks);
                                newFile.replaceWaypoints(0, file.wpt.length - 1, closest.filter((c) => c.index.includes(index)).map((c) => file.wpt[c.wptIndex]));
                                newFile._data.id = fileIds[index];
                                newFile.metadata.name = track.name ?? `${file.metadata.name} (${index + 1})`;
                                draft.set(newFile._data.id, freeze(newFile));
                            });
                        } else if (file.trk.length === 1) {
                            let fileIds = getFileIds(file.trk[0].trkseg.length);

                            let closest = file.wpt.map((wpt, wptIndex) => {
                                return {
                                    wptIndex: wptIndex,
                                    index: [0],
                                    distance: Number.MAX_VALUE
                                };
                            })
                            file.trk[0].trkseg.forEach((segment, index) => {
                                segment.trkpt.forEach((point) => {
                                    file.wpt.forEach((wpt, wptIndex) => {
                                        let dist = distance(point.getCoordinates(), wpt.getCoordinates());
                                        if (dist < closest[wptIndex].distance) {
                                            closest[wptIndex].distance = dist;
                                            closest[wptIndex].index = [index];
                                        } else if (dist === closest[wptIndex].distance) {
                                            closest[wptIndex].index.push(index);
                                        }
                                    });
                                });
                            });

                            file.trk[0].trkseg.forEach((segment, index) => {
                                let newFile = file.clone();
                                newFile.replaceTrackSegments(0, 0, file.trk[0].trkseg.length - 1, [segment]);
                                newFile.replaceWaypoints(0, file.wpt.length - 1, closest.filter((c) => c.index.includes(index)).map((c) => file.wpt[c.wptIndex]));
                                newFile._data.id = fileIds[index];
                                newFile.metadata.name = `${file.trk[0].name ?? file.metadata.name} (${index + 1})`;
                                draft.set(newFile._data.id, freeze(newFile));
                            });
                        }
                        draft.delete(fileId);
                    }
                } else if (level === ListLevel.TRACK) {
                    let file = draft.get(fileId);
                    if (file) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            let track = file.trk[trackIndex];
                            let tracks = track.trkseg.map((segment, segmentIndex) => {
                                let t = track.clone();
                                t.replaceTrackSegments(0, track.trkseg.length - 1, [segment]);
                                if (track.name) {
                                    t.name = `${track.name} (${segmentIndex + 1})`;
                                }
                                return t;
                            });
                            file.replaceTracks(trackIndex, trackIndex, tracks);
                        }
                    }
                }
            });
        });
    },
    split(fileId: string, trackIndex: number, segmentIndex: number, coordinates: Coordinates, trkptIndex?: number) {
        let splitType = get(splitAs);
        return applyGlobal((draft) => {
            let file = getFile(fileId);
            if (file) {
                let segment = file.trk[trackIndex].trkseg[segmentIndex];

                let minIndex = 0;
                if (trkptIndex === undefined) {
                    // Find the point closest to split
                    let closest = getClosestLinePoint(segment.trkpt, coordinates);
                    minIndex = closest._data.index;
                } else {
                    minIndex = trkptIndex;
                }

                let absoluteIndex = minIndex;
                file.forEachSegment((seg, trkIndex, segIndex) => {
                    if ((trkIndex < trackIndex && splitType === SplitType.FILES) || (trkIndex === trackIndex && segIndex < segmentIndex)) {
                        absoluteIndex += seg.trkpt.length;
                    }
                });

                if (splitType === SplitType.FILES) {
                    let newFile = draft.get(fileId);
                    if (newFile) {
                        newFile.crop(0, absoluteIndex);
                        let newFile2 = file.clone();
                        newFile2._data.id = getFileIds(1)[0];
                        newFile2.crop(absoluteIndex, file.getNumberOfTrackPoints() - 1);
                        draft.set(newFile2._data.id, freeze(newFile2));
                    }
                } else if (splitType === SplitType.TRACKS) {
                    let newFile = draft.get(fileId);
                    if (newFile) {
                        let start = file.trk[trackIndex].clone();
                        start.crop(0, absoluteIndex);
                        let end = file.trk[trackIndex].clone();
                        end.crop(absoluteIndex, file.trk[trackIndex].getNumberOfTrackPoints() - 1);
                        newFile.replaceTracks(trackIndex, trackIndex, [start, end]);
                    }
                } else if (splitType === SplitType.SEGMENTS) {
                    let newFile = draft.get(fileId);
                    if (newFile) {
                        let start = segment.clone();
                        start.crop(0, minIndex);
                        let end = segment.clone();
                        end.crop(minIndex, segment.trkpt.length - 1);
                        newFile.replaceTrackSegments(trackIndex, segmentIndex, segmentIndex, [start, end]);
                    }
                }
            }
        });
    },
    cleanSelection: (bounds: [Coordinates, Coordinates], inside: boolean, deleteTrackPoints: boolean, deleteWaypoints: boolean) => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.clean(bounds, inside, deleteTrackPoints, deleteWaypoints);
                    } else if (level === ListLevel.TRACK) {
                        let trackIndices = items.map((item) => (item as ListTrackItem).getTrackIndex());
                        file.clean(bounds, inside, deleteTrackPoints, deleteWaypoints, trackIndices);
                    } else if (level === ListLevel.SEGMENT) {
                        let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                        let segmentIndices = items.map((item) => (item as ListTrackSegmentItem).getSegmentIndex());
                        file.clean(bounds, inside, deleteTrackPoints, deleteWaypoints, trackIndices, segmentIndices);
                    } else if (level === ListLevel.WAYPOINTS) {
                        file.clean(bounds, inside, false, deleteWaypoints);
                    } else if (level === ListLevel.WAYPOINT) {
                        let waypointIndices = items.map((item) => (item as ListWaypointItem).getWaypointIndex());
                        file.clean(bounds, inside, false, deleteWaypoints, [], [], waypointIndices);
                    }
                }
            });
        });
    },
    reduce: (itemsAndPoints: Map<ListItem, TrackPoint[]>) => {
        if (itemsAndPoints.size === 0) {
            return;
        }
        applyGlobal((draft) => {
            let allItems = Array.from(itemsAndPoints.keys());
            applyToOrderedItemsFromFile(allItems, (fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    for (let item of items) {
                        if (item instanceof ListTrackSegmentItem) {
                            let trackIndex = item.getTrackIndex();
                            let segmentIndex = item.getSegmentIndex();
                            let points = itemsAndPoints.get(item);
                            if (points) {
                                file.replaceTrackPoints(trackIndex, segmentIndex, 0, file.trk[trackIndex].trkseg[segmentIndex].getNumberOfTrackPoints() - 1, points);
                            }
                        }
                    }
                }
            });
        });
    },
    addOrUpdateWaypoint: (waypoint: WaypointType, item?: ListWaypointItem) => {
        let m = get(map);
        if (m === null) {
            return;
        }
        getElevation([waypoint.attributes]).then((elevation) => {
            if (item) {
                dbUtils.applyToFile(item.getFileId(), (file) => {
                    let wpt = file.wpt[item.getWaypointIndex()];
                    wpt.name = waypoint.name;
                    wpt.desc = waypoint.desc;
                    wpt.cmt = waypoint.cmt;
                    wpt.sym = waypoint.sym;
                    wpt.link = waypoint.link;
                    wpt.setCoordinates(waypoint.attributes);
                    wpt.ele = elevation[0];
                });
            } else {
                let fileIds = new Set<string>();
                get(selection).getSelected().forEach((item) => {
                    fileIds.add(item.getFileId());
                });
                let wpt = new Waypoint(waypoint);
                wpt.ele = elevation[0];
                dbUtils.applyToFiles(Array.from(fileIds), (file) =>
                    file.replaceWaypoints(file.wpt.length, file.wpt.length, [wpt])
                );
            }
        });
    },
    setStyleToSelection: (style: LineStyleExtension) => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file && (level === ListLevel.FILE || level === ListLevel.TRACK)) {
                    if (level === ListLevel.FILE) {
                        file.setStyle(style);
                    } else if (level === ListLevel.TRACK) {
                        if (items.length === file.trk.length) {
                            file.setStyle(style);
                        } else {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                file.trk[trackIndex].setStyle(style);
                            }
                        }
                    }
                }
            });
        });
    },
    setHiddenToSelection: (hidden: boolean) => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.setHidden(hidden);
                    } else if (level === ListLevel.TRACK) {
                        let trackIndices = items.map((item) => (item as ListTrackItem).getTrackIndex());
                        file.setHidden(hidden, trackIndices);
                    } else if (level === ListLevel.SEGMENT) {
                        let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                        let segmentIndices = items.map((item) => (item as ListTrackSegmentItem).getSegmentIndex());
                        file.setHidden(hidden, trackIndices, segmentIndices);
                    } else if (level === ListLevel.WAYPOINTS) {
                        file.setHiddenWaypoints(hidden);
                    } else if (level === ListLevel.WAYPOINT) {
                        let waypointIndices = items.map((item) => (item as ListWaypointItem).getWaypointIndex());
                        file.setHiddenWaypoints(hidden, waypointIndices);
                    }
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
                    let file = draft.get(fileId);
                    if (file) {
                        if (level === ListLevel.TRACK) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                file.replaceTracks(trackIndex, trackIndex, []);
                            }
                        } else if (level === ListLevel.SEGMENT) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                file.replaceTrackSegments(trackIndex, segmentIndex, segmentIndex, []);
                            }
                        } else if (level === ListLevel.WAYPOINTS) {
                            file.replaceWaypoints(0, file.wpt.length - 1, []);
                        } else if (level === ListLevel.WAYPOINT) {
                            for (let item of items) {
                                let waypointIndex = (item as ListWaypointItem).getWaypointIndex();
                                file.replaceWaypoints(waypointIndex, waypointIndex, []);
                            }
                        }
                    }
                }
            });
        });
    },
    addElevationToSelection: async (map: mapboxgl.Map) => {
        if (get(selection).size === 0) {
            return;
        }
        let points: (TrackPoint | Waypoint)[] = [];
        applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            let file = fileState.get(fileId);
            if (file) {
                if (level === ListLevel.FILE) {
                    points.push(...file.getTrackPoints());
                    points.push(...file.wpt);
                } else if (level === ListLevel.TRACK) {
                    let trackIndices = items.map((item) => (item as ListTrackItem).getTrackIndex());
                    trackIndices.forEach((trackIndex) => {
                        points.push(...file.trk[trackIndex].getTrackPoints());
                    });
                } else if (level === ListLevel.SEGMENT) {
                    let trackIndex = (items[0] as ListTrackSegmentItem).getTrackIndex();
                    let segmentIndices = items.map((item) => (item as ListTrackSegmentItem).getSegmentIndex());
                    segmentIndices.forEach((segmentIndex) => {
                        points.push(...file.trk[trackIndex].trkseg[segmentIndex].getTrackPoints());
                    });
                } else if (level === ListLevel.WAYPOINTS) {
                    points.push(...file.wpt);
                } else if (level === ListLevel.WAYPOINT) {
                    let waypointIndices = items.map((item) => (item as ListWaypointItem).getWaypointIndex());
                    points.push(...waypointIndices.map((waypointIndex) => file.wpt[waypointIndex]));
                }
            }
        });

        if (points.length === 0) {
            return;
        }

        getElevation(points).then((elevations) => {
            applyGlobal((draft) => {
                applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                    let file = draft.get(fileId);
                    if (file) {
                        if (level === ListLevel.FILE) {
                            file.addElevation(elevations);
                        } else if (level === ListLevel.TRACK) {
                            let trackIndices = items.map((item) => (item as ListTrackItem).getTrackIndex());
                            file.addElevation(elevations, trackIndices, undefined, []);
                        } else if (level === ListLevel.SEGMENT) {
                            let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                            let segmentIndices = items.map((item) => (item as ListTrackSegmentItem).getSegmentIndex());
                            file.addElevation(elevations, trackIndices, segmentIndices, []);
                        } else if (level === ListLevel.WAYPOINTS) {
                            file.addElevation(elevations, [], [], undefined);
                        } else if (level === ListLevel.WAYPOINT) {
                            let waypointIndices = items.map((item) => (item as ListWaypointItem).getWaypointIndex());
                            file.addElevation(elevations, [], [], waypointIndices);
                        }
                    }
                });
            });
        });
    },
    deleteSelectedFiles: () => {
        if (get(selection).size === 0) {
            return;
        }
        applyGlobal((draft) => {
            applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
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