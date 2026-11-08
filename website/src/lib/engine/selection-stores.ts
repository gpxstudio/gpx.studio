import { readable, type Readable } from 'svelte/store';
import { engine, FileStateCollectionObserver, type FileState, type Selection } from '$lib/engine';
import { fileConversion, isSelectionHidden } from '$lib/engine/selection-helpers';

/**
 * A value computed from the selection and the states of the files. It follows the selection and,
 * through the observer of the files, the state of every file (hiding, editing).
 */
function fromSelectionAndFiles<T>(
    initial: T,
    compute: (selection: Selection, states: ReadonlyMap<string, FileState>) => T
): Readable<T> {
    return readable(initial, (set) => {
        let selection: Selection = { type: 'empty' };
        const states = new Map<string, FileState>();
        const unsubscribes = new Map<string, () => void>();

        const update = () => set(compute(selection, states));

        const unsubscribeSelection = engine.selection.subscribe(($selection) => {
            selection = $selection;
            update();
        });
        const observer = new FileStateCollectionObserver(
            (files) => {
                files.forEach((store, fileId) => {
                    unsubscribes.set(
                        fileId,
                        store.subscribe(($file) => {
                            states.set(fileId, $file);
                            update();
                        })
                    );
                });
            },
            (fileId) => {
                unsubscribes.get(fileId)?.();
                unsubscribes.delete(fileId);
                states.delete(fileId);
                update();
            },
            () => {
                unsubscribes.forEach((unsubscribe) => unsubscribe());
                unsubscribes.clear();
                states.clear();
            }
        );

        return () => {
            unsubscribeSelection();
            observer.destroy();
        };
    });
}

/** Whether all the selected elements are hidden. */
export const allHidden = fromSelectionAndFiles(false, isSelectionHidden);

/** What the selected files convert to, see `fileConversion`. */
export const selectedFilesConversion = fromSelectionAndFiles<'route' | 'track' | undefined>(
    undefined,
    fileConversion
);
