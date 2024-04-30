import { writable, get, type Readable, type Writable } from "svelte/store";
import { GPXFile } from "gpx";
import { produceWithPatches, type FreezedObject, type UnFreezedObject, applyPatches, type Patch } from "structurajs";
import { fileOrder, selectedFiles } from "./stores";

export type UndoRedoStore = {
    canUndo: boolean;
    canRedo: boolean;
    undo: () => void;
    redo: () => void;
}

export type GPXFileStore = Readable<GPXFile[]> & {
    undoRedo: Writable<UndoRedoStore>;
    add: (file: GPXFile) => void;
    addMultiple: (files: GPXFile[]) => void;
    applyToFile: (id: string, callback: (file: GPXFile) => void) => void;
    applyToSelectedFiles: (callback: (file: GPXFile) => void) => void;
    duplicateSelectedFiles: () => void;
    deleteSelectedFiles: () => void;
    deleteAllFiles: () => void;
    getFileStore: (id: string) => Writable<FreezedObject<GPXFile>> | undefined;
}

export function createGPXFileStore(): GPXFileStore {
    let files: ReadonlyMap<string, FreezedObject<GPXFile>> = new Map();
    let subscribers: Set<Function> = new Set();

    function notifySubscriber(run: Function) {
        run(Array.from(files.values()));
    }

    function notify() {
        subscribers.forEach((run) => {
            notifySubscriber(run);
        });
    }

    let filestores = new Map<string, Writable<FreezedObject<GPXFile>>>();
    let patches: { patch: Patch[], inversePatch: Patch[], global: boolean }[] = [];
    let patchIndex = -1;

    function updateUndoRedo() {
        undoRedo.update($undoRedo => {
            $undoRedo.canUndo = patchIndex >= 0;
            $undoRedo.canRedo = patchIndex < patches.length - 1;
            return $undoRedo;
        });
    }

    function appendPatches(patch: Patch[], inversePatch: Patch[], global: boolean) {
        patches = patches.slice(0, patchIndex + 1);
        patches.push({
            patch,
            inversePatch,
            global
        });
        patchIndex++;
        updateUndoRedo();
    }

    let undoRedo: Writable<UndoRedoStore> = writable({
        canUndo: false,
        canRedo: false,
        undo: () => {
            if (patchIndex >= 0) {
                applyPatch(patches[patchIndex].inversePatch, patches[patchIndex].global);
                patchIndex--;
            }
        },
        redo: () => {
            if (patchIndex < patches.length - 1) {
                patchIndex++;
                applyPatch(patches[patchIndex].patch, patches[patchIndex].global);
            }
        },
    });

    function applyPatch(patch: Patch[], global: boolean) {
        files = applyPatches(files, patch);
        for (let p of patch) {
            let fileId = p.p?.toString();
            if (fileId) {
                let filestore = filestores.get(fileId), newFile = files.get(fileId);
                if (filestore && newFile) {
                    filestore.set(newFile);
                }
            }
        }
        if (global) {
            console.log("Global patch", patch);
            notify();
        }
        updateUndoRedo();
    }

    function applyToGlobalStore(callback: (files: Map<string, GPXFile>) => void) {
        const [newFiles, patch, inversePatch] = produceWithPatches(files, callback);
        files = newFiles;
        appendPatches(patch, inversePatch, true);
        notify();
    }

    function applyToFiles(fileIds: string[], callback: (file: UnFreezedObject<FreezedObject<GPXFile>>) => void) {
        const [newFiles, patch, inversePatch] = produceWithPatches(files, (draft) => {
            fileIds.forEach((fileId) => {
                callback(draft.get(fileId));
            });
        });
        files = newFiles;
        appendPatches(patch, inversePatch, false);
        fileIds.forEach((fileId) => {
            let filestore = filestores.get(fileId), newFile = newFiles.get(fileId);
            if (filestore && newFile) {
                filestore.set(newFile);
            }
        });
    }

    subscribers.add(() => {
        // remove filestores that are no longer in the files map
        filestores.forEach((_, fileId) => {
            if (!files.has(fileId)) {
                filestores.delete(fileId);
            }
        });
        // add filestores that are in the files map but not in the filestores map
        files.forEach((file, fileId) => {
            if (!filestores.has(fileId)) {
                filestores.set(fileId, writable(file));
            }
        });
    });

    return {
        subscribe: (run) => {
            subscribers.add(run);
            notifySubscriber(run);
            return () => {
                subscribers.delete(run);
            }
        },
        undoRedo,
        add: (file: GPXFile) => {
            file._data.id = getLayerId();
            applyToGlobalStore((draft) => {
                draft.set(file._data.id, file);
            });
        },
        addMultiple: (files: GPXFile[]) => {
            applyToGlobalStore((draft) => {
                files.forEach((file) => {
                    file._data.id = getLayerId();
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
            applyToGlobalStore((draft) => {
                get(fileOrder).forEach((fileId) => {
                    if (get(selectedFiles).has(fileId)) {
                        let file = draft.get(fileId);
                        if (file) {
                            let clone = file.clone();
                            clone._data.id = getLayerId();
                            draft.set(clone._data.id, clone);
                        }
                    }
                });
            });
        },
        deleteSelectedFiles: () => {
            applyToGlobalStore((draft) => {
                get(selectedFiles).forEach((fileId) => {
                    draft.delete(fileId);
                });
            });
            selectedFiles.update($selected => {
                $selected.clear();
                return $selected;
            });
        },
        deleteAllFiles: () => {
            applyToGlobalStore((draft) => {
                draft.clear();
            });
            selectedFiles.update($selected => {
                $selected.clear();
                return $selected;
            });
        },
        getFileStore: (id: string) => {
            return filestores.get(id);
        }
    }
}

let id = 0;
function getLayerId() {
    return `gpx-${id++}`;
}