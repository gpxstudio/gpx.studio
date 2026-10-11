import { LEGACY_IMPORTED_KEY, readLegacyData } from '$lib/storage/legacy-import';
import { parseVisibility, VISIBILITY_KEY, type Visibility } from '$lib/engine/file-visibility';
import type { Outcome, StorageOpened } from 'gpx-rs';
import type { Wasm } from './convert';

/** Name of the IndexedDB database that keeps the files and the settings. */
const STORAGE_NAME = 'gpx-studio';

/** Name of the channel that tells the tabs that the files were written. */
const CHANNEL_NAME = 'gpx-studio-storage';

/** What opening the storage needs of the engine facade. */
export type StorageHost = {
    wasm: Wasm;
    /** The explicit visibility per file, to fill with the one that was saved. */
    visibility: Map<string, Visibility>;
    /** Applies what a call changed to what the facade keeps of the files. */
    sync(update: Outcome): void;
    hasFiles(): boolean;
    loadFiles(files: { data: Uint8Array; name: string }[]): Promise<boolean>;
    deselect(): Promise<boolean>;
};

/**
 * Keeps the files of the engine as the ones that another tab saved: when a tab writes, the others
 * are told, and read the storage again if it has changed since they last did, which overwrites
 * what they hold (see `sync_storage`). The same happens when a write of this tab is refused
 * because of that, and when the tab is shown again (a hidden tab can miss messages).
 */
function followOtherTabs(host: StorageHost): { saved: () => void; behind: () => void } {
    const { wasm } = host;
    let reading = Promise.resolve();
    const refresh = () => {
        reading = reading
            .then(async () => host.sync(await wasm.sync_storage()))
            .catch((error) => console.error('The files could not be read again', error));
    };
    const channel =
        typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CHANNEL_NAME);
    if (channel) {
        channel.onmessage = refresh;
    }
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        });
    }
    return { saved: () => channel?.postMessage('saved'), behind: refresh };
}

/**
 * Opens the storage of the browser: the files that it holds are put in the engine, and the
 * changes of the files are kept from then on. Resolves to the settings, as JSON strings by key.
 *
 * The first time, what the previous versions of the app kept in the browser is imported.
 */
export async function openStoredFiles(host: StorageHost): Promise<Record<string, string>> {
    const { wasm } = host;
    let opened: StorageOpened;
    const tabs = followOtherTabs(host);
    try {
        opened = await wasm.open_storage(STORAGE_NAME, tabs.saved, tabs.behind);
    } catch (error) {
        console.error('The files cannot be kept in this browser', error);
        return {};
    }
    let settings = opened.settings;
    // what was hidden, which the files that were restored need when they are read
    parseVisibility(settings[VISIBILITY_KEY]).forEach((visibility, fileId) =>
        host.visibility.set(fileId, visibility)
    );
    host.sync(opened.outcome);

    if (settings[LEGACY_IMPORTED_KEY] === undefined && !host.hasFiles()) {
        settings = { ...settings, ...(await importLegacyData(host)) };
        await wasm.flush_storage();
    }
    return settings;
}

/** Puts the files and the settings of the former database in the engine. */
async function importLegacyData(host: StorageHost): Promise<Record<string, string>> {
    const { wasm } = host;
    const imported: Record<string, string> = {};
    try {
        const legacy = await readLegacyData();
        if (legacy) {
            const encoder = new TextEncoder();
            if (legacy.files.length > 0) {
                await host.loadFiles(
                    legacy.files.map((file) => ({
                        data: encoder.encode(file.gpx),
                        name: file.name,
                    }))
                );
                await host.deselect();
            }
            for (const [key, value] of Object.entries(legacy.settings)) {
                wasm.set_setting(key, value);
                imported[key] = value;
            }
        }
    } catch (error) {
        // it is tried again next time
        console.error('The files of the previous version could not be imported', error);
        return imported;
    }
    wasm.set_setting(LEGACY_IMPORTED_KEY, 'true');
    imported[LEGACY_IMPORTED_KEY] = 'true';
    return imported;
}
