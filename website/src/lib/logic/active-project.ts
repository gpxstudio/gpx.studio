import { get, writable, type Writable } from 'svelte/store';
import { createProjectDatabase, type Database } from '$lib/db';
import { settings } from '$lib/logic/settings';
import { fileStateCollection } from '$lib/logic/file-state';
import { fileActionManager } from '$lib/logic/file-action-manager';
import { selection } from '$lib/logic/selection';
import { activeProjectId, touchProject } from '$lib/logic/project-registry';
import { map } from '$lib/components/map/map';

// The currently active project DB — initialized later via initializeProjects()
export const currentDb: Writable<Database | null> = writable(null);

// ── Camera persistence ─────────────────────────────────────────────────────

interface CameraState {
    center: { lng: number; lat: number };
    zoom: number;
    bearing: number;
    pitch: number;
}

export async function saveMapCamera(db: Database): Promise<void> {
    const map_ = get(map);
    if (!map_) return;
    const center = map_.getCenter();
    const state: CameraState = {
        center: { lng: center.lng, lat: center.lat },
        zoom: map_.getZoom(),
        bearing: map_.getBearing(),
        pitch: map_.getPitch(),
    };
    await db.settings.put(state, 'mapCamera');
}

export async function restoreMapCamera(db: Database): Promise<void> {
    const map_ = get(map);
    if (!map_) return;
    const state = await db.settings.get('mapCamera') as CameraState | undefined;
    if (state) {
        map_.jumpTo({
            center: state.center,
            zoom: state.zoom,
            bearing: state.bearing,
            pitch: state.pitch,
        });
    }
}

// ── Tab switching ──────────────────────────────────────────────────────────

let _switching = false;

/**
 * Switch the active project to `newProjectId`.
 * Saves camera from old project, swaps all DB connections, restores camera for new project.
 * Re-entrant calls are ignored while a switch is in progress.
 */
export async function switchToProject(newProjectId: string): Promise<void> {
    if (_switching) return;
    _switching = true;
    try {
        await _doSwitchToProject(newProjectId);
    } finally {
        _switching = false;
    }
}

async function _doSwitchToProject(newProjectId: string): Promise<void> {
    const oldDb = get(currentDb);

    // 1. Save current map camera to old project DB
    if (oldDb) {
        await saveMapCamera(oldDb);
    }

    // 2. Disconnect all state managers from old DB
    settings.disconnectFromDatabase();
    fileStateCollection.disconnectFromDatabase();
    fileActionManager.disconnectFromDatabase();

    // 3. Close old DB
    if (oldDb) {
        oldDb.close();
    }

    // 4. Open new project DB
    const newDb = createProjectDatabase(newProjectId);
    currentDb.set(newDb);

    // 5. Reconnect all state managers to new DB
    settings.connectToDatabase(newDb);
    await fileStateCollection.connectToDatabase(newDb);
    fileActionManager.reconnectToDatabase(newDb);

    // 6. Clear selection (it's ephemeral, not per-project)
    selection.set([]);

    // 7. Restore map camera for new project
    await restoreMapCamera(newDb);

    // 8. Update activeProjectId store + localStorage
    activeProjectId.set(newProjectId);

    // 9. Touch updatedAt in registry
    await touchProject(newProjectId);
}
