import type { Readable } from 'svelte/store';
import { engine } from './engine';
import type { FileState, FileStatesCallback } from './types';

/**
 * Tells when file stores appear and disappear, so that their subscribers know when to
 * subscribe and unsubscribe. `onFilesAdded` is called with the stores of the new files only
 * (including the ones already present when the observer is created).
 */
export class FileStateCollectionObserver {
    private _fileIds = new Set<string>();
    private _onFilesAdded: FileStatesCallback;
    private _onFileRemoved: (fileId: string) => void;
    private _onDestroy: () => void;
    private _unsubscribe: () => void;

    constructor(
        onFilesAdded: FileStatesCallback,
        onFileRemoved: (fileId: string) => void,
        onDestroy: () => void
    ) {
        this._onFilesAdded = onFilesAdded;
        this._onFileRemoved = onFileRemoved;
        this._onDestroy = onDestroy;

        this._unsubscribe = engine.files.subscribe((files) => {
            this._fileIds.forEach((fileId) => {
                if (!files.has(fileId)) {
                    this._onFileRemoved(fileId);
                    this._fileIds.delete(fileId);
                }
            });
            const newFiles = new Map<string, Readable<FileState>>();
            files.forEach((store, fileId) => {
                if (!this._fileIds.has(fileId)) {
                    newFiles.set(fileId, store);
                    this._fileIds.add(fileId);
                }
            });
            if (newFiles.size > 0) {
                this._onFilesAdded(newFiles);
            }
        });
    }

    destroy() {
        this._onDestroy();
        this._unsubscribe();
    }
}
