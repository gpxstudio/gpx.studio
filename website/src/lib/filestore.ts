import { writable, get, type Readable, type Writable } from "svelte/store";
import { GPXFile } from "gpx";
import { produceWithPatches, enableMapSet, enablePatches, type Immutable } from "immer";
import { fileOrder, selectedFiles } from "./stores";

enableMapSet();
enablePatches();

export type GPXFileStore = Readable<GPXFile[]> & {
    add: (file: GPXFile) => void;
    addMultiple: (files: GPXFile[]) => void;
    applyToFile: (id: string, callback: (file: GPXFile) => void) => void;
    applyToSelectedFiles: (callback: (file: GPXFile) => void) => void;
    duplicateSelectedFiles: () => void;
    deleteSelectedFiles: () => void;
    deleteAllFiles: () => void;
    getFileStore: (id: string) => Writable<Immutable<GPXFile>> | undefined;
}

export function createGPXFileStore(): GPXFileStore {
    let files: Immutable<Map<string, GPXFile>> = new Map();
    let subscribers: Set<Function> = new Set();

    let filestores = new Map<string, Writable<Immutable<GPXFile>>>();

    let patches = [];

    function notifySubscriber(run: Function) {
        run(Array.from(files.values()));
    }

    function notify() {
        subscribers.forEach((run) => {
            notifySubscriber(run);
        });
    }

    function applyToGlobalStore(callback: (files: Map<string, GPXFile>) => void) {
        const [newFiles, patch, inversePatch] = produceWithPatches(files, callback);
        files = newFiles;
        patches.push({
            patch,
            inversePatch,
            global: true
        });
        console.log(patches[patches.length - 1]);
        notify();
    }

    function applyToFiles(fileIds: string[], callback: (file: GPXFile) => void) {
        const [newFiles, patch, inversePatch] = produceWithPatches(files, (draft) => {
            fileIds.forEach((fileId) => {
                if (draft.has(fileId)) {
                    callback(draft.get(fileId));
                }
            });
        });
        files = newFiles;
        patches.push({
            patch,
            inversePatch,
            global: false
        });
        console.log(patches[patches.length - 1]);
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