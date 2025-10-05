import { db, type Database } from '$lib/db';
import { liveQuery } from 'dexie';
import type { GPXFile } from 'gpx';
import { applyPatches, produceWithPatches, type Patch, type WritableDraft } from 'immer';
import { fileStateCollection, type GPXFileStateCollection } from '$lib/logic/file-state.svelte';

const MAX_PATCHES = 100;

export class FileActionManager {
    private _db: Database;
    private _files: Map<string, GPXFile>;
    private _patchIndex: number;
    private _patchMinIndex: number;
    private _patchMaxIndex: number;

    constructor(db: Database, fileStateCollection: GPXFileStateCollection) {
        this._db = db;

        this._files = $derived.by(() => {
            let files = new Map<string, GPXFile>();
            fileStateCollection.files.forEach((state, id) => {
                if (state.file) {
                    files.set(id, state.file);
                }
            });
            return files;
        });

        this._patchIndex = $state(-1);
        this._patchMinIndex = $state(0);
        this._patchMaxIndex = $state(0);

        liveQuery(() => db.settings.get('patchIndex')).subscribe((value) => {
            if (value !== undefined) {
                this._patchIndex = value;
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
            this._patchMinIndex = value.min;
            this._patchMaxIndex = value.max;
        });
    }

    async store(patch: Patch[], inversePatch: Patch[]) {
        this._db.patches.where(':id').above(this._patchIndex).delete(); // Delete all patches after the current patch to avoid redoing them
        if (this._patchMaxIndex - this._patchMinIndex + 1 > MAX_PATCHES) {
            this._db.patches
                .where(':id')
                .belowOrEqual(this._patchMaxIndex - MAX_PATCHES)
                .delete();
        }
        this._db.transaction('rw', this._db.patches, this._db.settings, async () => {
            let index = this._patchIndex + 1;
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

    get canUndo(): boolean {
        return this._patchIndex >= this._patchMinIndex;
    }

    get canRedo(): boolean {
        return this._patchIndex < this._patchMaxIndex - 1;
    }

    undo() {
        if (this.canUndo) {
            this._db.patches.get(this._patchIndex).then((patch) => {
                if (patch) {
                    this.apply(patch.inversePatch);
                    this._db.settings.put(this._patchIndex - 1, 'patchIndex');
                }
            });
        }
    }

    redo() {
        if (this.canRedo) {
            this._db.patches.get(this._patchIndex + 1).then((patch) => {
                if (patch) {
                    this.apply(patch.patch);
                    this._db.settings.put(this._patchIndex + 1, 'patchIndex');
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

        // updateSelection(updatedFiles, deletedFileIds);

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

        this.store(patch, inversePatch);

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

        this.store(patch, inversePatch);

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

        this.store(patch, inversePatch);

        return this.commitFileStateChange(newFileCollection, patch);
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
