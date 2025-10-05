import { updateAnchorPoints } from '$lib/components/toolbar/tools/routing/Simplify';
import { db, type Database } from '$lib/db';
import { liveQuery } from 'dexie';
import { GPXFile } from 'gpx';
import { GPXStatisticsTree, type GPXFileWithStatistics } from '$lib/logic/statistics';
import { settings } from '$lib/logic/settings.svelte';

// Observe a single file from the database, and maintain its statistics
class GPXFileState {
    private _file: GPXFileWithStatistics | undefined;
    private _subscription: { unsubscribe: () => void } | undefined;

    constructor(db: Database, fileId: string) {
        this._file = $state(undefined);
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

                this._file = { file, statistics };

                // if (get(selection).hasAnyChildren(new ListFileItem(id))) {
                //     updateAllHidden();
                // }
            }
        });
    }

    destroy() {
        this._subscription?.unsubscribe();
        this._subscription = undefined;
        this._file = undefined;
    }

    get file(): GPXFile | undefined {
        return this._file?.file;
    }

    get statistics(): GPXStatisticsTree | undefined {
        return this._file?.statistics;
    }
}

// Observe the file ids in the database, and maintain a map of file states for the corresponding files
export class GPXFileStateCollection {
    private _db: Database;
    private _files: Map<string, GPXFileState>;

    constructor(db: Database) {
        this._db = db;
        this._files = $state(new Map());
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
            // Find new files to observe
            let newFiles = dbFileIds
                .filter((id) => !this._files.has(id))
                .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
            // Find deleted files to stop observing
            let deletedFiles = Array.from(this._files.keys()).filter(
                (id) => !dbFileIds.find((fileId) => fileId === id)
            );

            if (newFiles.length > 0 || deletedFiles.length > 0) {
                // Update the map of file states
                let files = new Map(this._files);
                newFiles.forEach((id) => {
                    files.set(id, new GPXFileState(this._db, id));
                });
                deletedFiles.forEach((id) => {
                    files.get(id)?.destroy();
                    files.delete(id);
                });
                this._files = files;

                // Update the file order
                let fileOrder = settings.fileOrder.value.filter((id) => !deletedFiles.includes(id));
                newFiles.forEach((id) => {
                    if (!fileOrder.includes(id)) {
                        fileOrder.push(id);
                    }
                });
                settings.fileOrder.value = fileOrder;
            }
        });
    }

    get files(): ReadonlyMap<string, GPXFileState> {
        return this._files;
    }

    get size(): number {
        return this._files.size;
    }

    getFile(fileId: string): GPXFile | undefined {
        let fileState = this._files.get(fileId);
        return fileState?.file;
    }

    getStatistics(fileId: string): GPXStatisticsTree | undefined {
        let fileState = this._files.get(fileId);
        return fileState?.statistics;
    }
}

// Collection of all file states
export const fileStateCollection = new GPXFileStateCollection(db);
