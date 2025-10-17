import { db, type Database } from '$lib/db';
import { liveQuery } from 'dexie';
import type { GPXFile } from 'gpx';
import { applyPatches, produceWithPatches, type Patch, type WritableDraft } from 'immer';
import {
    fileStateCollection,
    GPXFileStateCollectionObserver,
    type GPXFileStateCollection,
} from '$lib/logic/file-state';
import {
    derived,
    get,
    writable,
    type Readable,
    type Unsubscriber,
    type Writable,
} from 'svelte/store';
import { selection } from '$lib/logic/selection';

const MAX_PATCHES = 100;

export class FileActionManager {
    private _db: Database;
    private _files: Map<string, GPXFile>;
    private _fileSubscriptions: Map<string, Unsubscriber>;
    private _fileStateCollectionObserver: GPXFileStateCollectionObserver;
    private _patchIndex: Writable<number>;
    private _patchMinIndex: Writable<number>;
    private _patchMaxIndex: Writable<number>;
    private _canUndo: Readable<boolean>;
    private _canRedo: Readable<boolean>;

    constructor(db: Database, fileStateCollection: GPXFileStateCollection) {
        this._db = db;
        this._files = new Map();
        this._fileSubscriptions = new Map();
        this._fileStateCollectionObserver = new GPXFileStateCollectionObserver(
            (fileId, fileState) => {
                this._fileSubscriptions.set(
                    fileId,
                    fileState.subscribe((fileWithStatistics) => {
                        if (fileWithStatistics) {
                            this._files.set(fileId, fileWithStatistics.file);
                        }
                    })
                );
            },
            (fileId) => {
                let unsubscribe = this._fileSubscriptions.get(fileId);
                if (unsubscribe) {
                    unsubscribe();
                    this._fileSubscriptions.delete(fileId);
                }
                this._files.delete(fileId);
            },
            () => {
                this._fileSubscriptions.forEach((unsubscribe) => unsubscribe());
                this._fileSubscriptions.clear();
                this._files.clear();
            }
        );

        this._patchIndex = writable(-1);
        this._patchMinIndex = writable(0);
        this._patchMaxIndex = writable(0);

        liveQuery(() => db.settings.get('patchIndex')).subscribe((value) => {
            if (value !== undefined) {
                this._patchIndex.set(value);
            }
        });
        liveQuery(() =>
            (db.patches.orderBy(':id').keys() as Promise<number[]>).then((keys) => {
                if (keys.length === 0) {
                    return { min: 0, max: 0 };
                } else {
                    return { min: keys[0], max: keys[keys.length - 1] + 1 };
                }
            })
        ).subscribe((value) => {
            this._patchMinIndex.set(value.min);
            this._patchMaxIndex.set(value.max);
        });

        this._canUndo = derived(
            [this._patchIndex, this._patchMinIndex],
            ([$patchIndex, $patchMinIndex]) => {
                return $patchIndex >= $patchMinIndex;
            }
        );
        this._canRedo = derived(
            [this._patchIndex, this._patchMaxIndex],
            ([$patchIndex, $patchMaxIndex]) => {
                return $patchIndex < $patchMaxIndex - 1;
            }
        );
    }

    get canUndo(): Readable<boolean> {
        return this._canUndo;
    }

    get canRedo(): Readable<boolean> {
        return this._canRedo;
    }

    undo() {
        if (get(this.canUndo)) {
            const patchIndex = get(this._patchIndex);
            this._db.patches.get(patchIndex).then((patch) => {
                if (patch) {
                    this.apply(patch.inversePatch);
                    this._db.settings.put(patchIndex - 1, 'patchIndex');
                }
            });
        }
    }

    redo() {
        if (get(this.canRedo)) {
            const patchIndex = get(this._patchIndex) + 1;
            this._db.patches.get(patchIndex).then((patch) => {
                if (patch) {
                    this.apply(patch.patch);
                    this._db.settings.put(patchIndex, 'patchIndex');
                }
            });
        }
    }

    apply(patch: Patch[]) {
        let newFiles = applyPatches(this._files, patch);
        return this.commitFileStateChange(newFiles, patch);
    }

    commitFileStateChange(newFiles: ReadonlyMap<string, GPXFile>, patch: Patch[]) {
        let changedFileIds = getChangedFileIds(patch);
        let updatedFileIds: string[] = [],
            deletedFileIds: string[] = [];

        changedFileIds.forEach((id) => {
            if (newFiles.has(id)) {
                updatedFileIds.push(id);
            } else {
                deletedFileIds.push(id);
            }
        });

        let updatedFiles = updatedFileIds
            .map((id) => newFiles.get(id))
            .filter((file) => file !== undefined) as GPXFile[];
        updatedFileIds = updatedFiles.map((file) => file._data.id);

        selection.update(updatedFiles, deletedFileIds);

        // @ts-ignore
        return db.transaction('rw', db.fileids, db.files, async () => {
            if (updatedFileIds.length > 0) {
                await this._db.fileids.bulkPut(updatedFileIds, updatedFileIds);
                await this._db.files.bulkPut(updatedFiles, updatedFileIds);
            }
            if (deletedFileIds.length > 0) {
                await this._db.fileids.bulkDelete(deletedFileIds);
                await this._db.files.bulkDelete(deletedFileIds);
            }
        });
    }

    applyGlobal(callback: (files: Map<string, GPXFile>) => void) {
        const [newFileCollection, patch, inversePatch] = produceWithPatches(this._files, callback);

        this.storePatches(patch, inversePatch);

        return this.commitFileStateChange(newFileCollection, patch);
    }

    applyToFiles(fileIds: string[], callback: (file: WritableDraft<GPXFile>) => void) {
        const [newFileCollection, patch, inversePatch] = produceWithPatches(
            this._files,
            (draft) => {
                fileIds.forEach((fileId) => {
                    let file = draft.get(fileId);
                    if (file) {
                        callback(file);
                    }
                });
            }
        );

        this.storePatches(patch, inversePatch);

        return this.commitFileStateChange(newFileCollection, patch);
    }

    applyToFile(fileId: string, callback: (file: WritableDraft<GPXFile>) => void) {
        return this.applyToFiles([fileId], callback);
    }

    applyEachToFilesAndGlobal(
        fileIds: string[],
        callbacks: ((file: WritableDraft<GPXFile>, context?: any) => void)[],
        globalCallback: (files: Map<string, GPXFile>, context?: any) => void,
        context?: any
    ) {
        const [newFileCollection, patch, inversePatch] = produceWithPatches(
            this._files,
            (draft) => {
                fileIds.forEach((fileId, index) => {
                    let file = draft.get(fileId);
                    if (file) {
                        callbacks[index](file, context);
                    }
                });
                globalCallback(draft, context);
            }
        );

        this.storePatches(patch, inversePatch);

        return this.commitFileStateChange(newFileCollection, patch);
    }

    async storePatches(patch: Patch[], inversePatch: Patch[]) {
        this._db.patches.where(':id').above(get(this._patchIndex)).delete(); // Delete all patches after the current patch to avoid redoing them
        if (get(this._patchMaxIndex) - get(this._patchMinIndex) + 1 > MAX_PATCHES) {
            this._db.patches
                .where(':id')
                .belowOrEqual(get(this._patchMaxIndex) - MAX_PATCHES)
                .delete();
        }
        this._db.transaction('rw', this._db.patches, this._db.settings, async () => {
            let index = get(this._patchIndex) + 1;
            await this._db.patches.put(
                {
                    patch,
                    inversePatch,
                    index,
                },
                index
            );
            await this._db.settings.put(index, 'patchIndex');
        });
    }
}

// Get the file ids of the files that have changed in the patch
function getChangedFileIds(patch: Patch[]): string[] {
    let changedFileIds = new Set<string>();
    for (let p of patch) {
        changedFileIds.add(p.path[0] as string);
    }
    return Array.from(changedFileIds);
}

export const fileActionManager = new FileActionManager(db, fileStateCollection);
