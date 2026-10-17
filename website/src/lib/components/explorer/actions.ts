import { get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { engine } from '$lib/engine';
import { i18n } from '$lib/i18n/i18n.svelte';
import { boundsManager } from '$lib/state/bounds';

/**
 * Opens files of the tree: as a preview (a single click), which the next preview replaces, or for
 * good. The map fits the files that were opened.
 */
export async function openFiles(paths: string[], preview: boolean) {
    const ids = await engine.openPaths(paths, preview);
    if (ids.length > 0) {
        boundsManager.fitBoundsOnLoad(ids);
    }
}

/** Tells why what the explorer did failed (a key of the dictionaries, or a message). */
export function showError() {
    const error = get(engine.lastError);
    if (error !== undefined && error !== 'nothing to do') {
        toast.error(i18n._(error, error));
    }
}
