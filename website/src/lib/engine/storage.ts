import { LEGACY_IMPORTED_KEY, readLegacyData } from '$lib/legacy-import';
import { parseVisibility, VISIBILITY_KEY, type Visibility } from '$lib/file-visibility';
import type { FilesUpdate, StorageOpened } from 'gpx-rs';
import type { Wasm } from './convert';

/** Name of the IndexedDB database that keeps the files and the settings. */
const STORAGE_NAME = 'gpx-studio';

/** What opening the storage needs of the engine facade. */
export type StorageHost = {
    wasm: Wasm;
    /** The explicit visibility per file, to fill with the one that was saved. */
    visibility: Map<string, Visibility>;
    /** Applies what a call changed to what the facade keeps of the files. */
    sync(update: FilesUpdate): void;
    hasFiles(): boolean;
    loadFiles(files: { data: Uint8Array; name: string }[]): Promise<boolean>;
    deselect(): Promise<boolean>;
};

/**
 * Opens the storage of the browser: the files that it holds are put in the engine, and the
 * changes of the files are kept from then on. Resolves to the settings, as JSON strings by key.
 *
 * The first time, what the previous versions of the app kept in the browser is imported.
 */
export async function openStoredFiles(host: StorageHost): Promise<Record<string, string>> {
    const { wasm } = host;
    let opened: StorageOpened;
    try {
        opened = await wasm.open_storage(STORAGE_NAME);
    } catch (error) {
        console.error('The files cannot be kept in this browser', error);
        return {};
    }
    if (opened.readOnly) {
        console.warn(
            'The files were saved by a newer version of the app: they are not saved again by this one'
        );
    }
    if (opened.unreadable > 0) {
        console.warn(`${opened.unreadable} stored file(s) could not be read`);
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
