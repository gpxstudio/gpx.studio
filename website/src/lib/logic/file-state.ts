import { updateAnchorPoints } from '$lib/components/toolbar/tools/routing/Simplify';
import { db, type Database } from '$lib/db';
import { liveQuery } from 'dexie';
import { GPXFile } from 'gpx';
import { GPXStatisticsTree, type GPXFileWithStatistics } from '$lib/logic/statistics-tree';
import { settings } from '$lib/logic/settings';
import { get, writable, type Subscriber, type Writable } from 'svelte/store';

// Observe a single file from the database, and maintain its statistics
export class GPXFileState {
    private _file: Writable<GPXFileWithStatistics | undefined>;
    private _subscription: { unsubscribe: () => void } | undefined;

    constructor(db: Database, fileId: string) {
        this._file = writable(undefined);
        let first = true;

        this._subscription = liveQuery(() => db.files.get(fileId)).subscribe((value) => {
            if (value !== undefined) {
                let file = new GPXFile(value);
                updateAnchorPoints(file);

                let statistics = new GPXStatisticsTree(file);
                if (first) {
                    // Update the map bounds for new files
                    // updateTargetMapBounds(
                    //     id,
                    //     statistics.getStatisticsFor(new ListFileItem(id)).global.bounds
                    // );
                    first = false;
                }

                this._file.set({ file, statistics });

                // if (get(selection).hasAnyChildren(new ListFileItem(id))) {
                //     updateAllHidden();
                // }
            }
        });
    }

    subscribe(run: Subscriber<GPXFileWithStatistics | undefined>, invalidate?: () => void) {
        return this._file.subscribe(run, invalidate);
    }

    destroy() {
        this._subscription?.unsubscribe();
        this._subscription = undefined;
    }

    get file(): GPXFile | undefined {
        return get(this._file)?.file;
    }

    get statistics(): GPXStatisticsTree | undefined {
        return get(this._file)?.statistics;
    }
}

// Observe the file ids in the database, and maintain a map of file states for the corresponding files
export class GPXFileStateCollection {
    private _db: Database;
    private _files: Writable<Map<string, GPXFileState>>;

    constructor(db: Database) {
        this._db = db;
        this._files = writable(new Map());
    }

    subscribe(run: Subscriber<Map<string, GPXFileState>>, invalidate?: () => void) {
        return this._files.subscribe(run, invalidate);
    }

    initialize(fitBounds: boolean) {
        let initialize = true;
        liveQuery(() => this._db.fileids.toArray()).subscribe((dbFileIds) => {
            if (initialize) {
                // if (fitBounds && dbFileIds.length > 0) {
                //     initTargetMapBounds(dbFileIds);
                // }
                initialize = false;
            }
            const currentFiles = get(this._files);
            // Find new files to observe
            let newFiles = dbFileIds
                .filter((id) => !currentFiles.has(id))
                .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
            // Find deleted files to stop observing
            let deletedFiles = Array.from(currentFiles.keys()).filter(
                (id) => !dbFileIds.find((fileId) => fileId === id)
            );

            if (newFiles.length > 0 || deletedFiles.length > 0) {
                // Update the map of file states
                this._files.update(($files) => {
                    newFiles.forEach((id) => {
                        $files.set(id, new GPXFileState(this._db, id));
                    });
                    deletedFiles.forEach((id) => {
                        $files.get(id)?.destroy();
                        $files.delete(id);
                    });
                    return $files;
                });

                // Update the file order
                let fileOrder = get(settings.fileOrder).filter((id) => !deletedFiles.includes(id));
                newFiles.forEach((id) => {
                    if (!fileOrder.includes(id)) {
                        fileOrder.push(id);
                    }
                });
                settings.fileOrder.set(fileOrder);
            }
        });
    }

    get size(): number {
        return get(this._files).size;
    }

    getFileState(fileId: string): GPXFileState | undefined {
        return get(this._files).get(fileId);
    }

    getFile(fileId: string): GPXFile | undefined {
        let fileState = get(this._files).get(fileId);
        return fileState?.file;
    }

    getStatistics(fileId: string): GPXStatisticsTree | undefined {
        let fileState = get(this._files).get(fileId);
        return fileState?.statistics;
    }

    forEach(callback: (fileId: string, file: GPXFile) => void) {
        get(this._files).forEach((fileState, fileId) => {
            if (fileState.file) {
                callback(fileId, fileState.file);
            }
        });
    }
}

// Collection of all file states
export const fileStateCollection = new GPXFileStateCollection(db);

export type GPXFileStateCallback = (fileId: string, fileState: GPXFileState) => void;
export class GPXFileStateCollectionObserver {
    private _fileIds: Set<string>;
    private _onFileAdded: GPXFileStateCallback;
    private _onFileRemoved: (fileId: string) => void;
    private _onDestroy: () => void;
    private _unsubscribe: () => void;

    constructor(
        onFileAdded: GPXFileStateCallback,
        onFileRemoved: (fileId: string) => void,
        onDestroy: () => void
    ) {
        this._fileIds = new Set();
        this._onFileAdded = onFileAdded;
        this._onFileRemoved = onFileRemoved;
        this._onDestroy = onDestroy;

        this._unsubscribe = fileStateCollection.subscribe((files) => {
            this._fileIds.forEach((fileId) => {
                if (!files.has(fileId)) {
                    this._onFileRemoved(fileId);
                    this._fileIds.delete(fileId);
                }
            });
            files.forEach((file: GPXFileState, fileId: string) => {
                if (!this._fileIds.has(fileId)) {
                    this._onFileAdded(fileId, file);
                    this._fileIds.add(fileId);
                }
            });
        });
    }

    destroy() {
        this._onDestroy();
        this._unsubscribe();
    }
}
