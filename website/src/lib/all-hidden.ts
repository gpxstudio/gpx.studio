import { readable } from 'svelte/store';
import { engine, FileStateCollectionObserver, type FileState, type Selection } from '$lib/engine';
import { isSelectionHidden } from '$lib/selection-helpers';

/**
 * Whether all the selected elements are hidden. It follows the selection and, through the
 * observer of the files, the state of every file (hiding, editing).
 */
export const allHidden = readable(false, (set) => {
    let selection: Selection = { type: 'empty' };
    const states = new Map<string, FileState>();
    const unsubscribes = new Map<string, () => void>();

    const update = () => set(isSelectionHidden(selection, states));

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
