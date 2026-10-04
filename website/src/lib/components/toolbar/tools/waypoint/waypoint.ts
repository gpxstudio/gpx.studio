import { get, writable } from 'svelte/store';
import { engine, type WaypointDetails } from '$lib/engine';
import { settings } from '$lib/logic/settings';

export type SelectedWaypoint = {
    fileId: string;
    id: string;
    /** The data of the waypoint, kept up to date with the file. */
    waypoint: WaypointDetails;
};

/**
 * The waypoint that the waypoint tool is about: the selected one when the file tree is shown and
 * a single waypoint is selected, or the one that was set explicitly (clicking a waypoint of the
 * map) until the selection changes to something else than its file or itself (that is what
 * clicking it selects, depending on the view, and the selection may arrive after it is set).
 */
export class WaypointSelection {
    private _selection = writable<SelectedWaypoint | undefined>(undefined);
    private _fileUnsubscribe: (() => void) | undefined;
    private _explicit: { fileId: string; id: string } | undefined;

    constructor() {
        settings.treeFileView.subscribe(() => this.updateFromSelection());
        engine.selection.subscribe(() => this.updateFromSelection());
    }

    subscribe(
        run: (value: SelectedWaypoint | undefined) => void,
        invalidate?: (value?: SelectedWaypoint | undefined) => void
    ) {
        return this._selection.subscribe(run, invalidate);
    }

    /** Sets the waypoint, whatever the selection is. */
    set(target: { fileId: string; id: string } | undefined) {
        this._explicit = target;
        this.track(target);
    }

    updateFromSelection() {
        const selection = get(engine.selection);
        const explicit = this._explicit;
        if (
            explicit &&
            ((selection.type === 'file' &&
                selection.fileIds.length === 1 &&
                selection.fileIds[0] === explicit.fileId) ||
                (selection.type === 'waypoint' &&
                    selection.fileId === explicit.fileId &&
                    selection.waypointIds.length === 1 &&
                    selection.waypointIds[0] === explicit.id))
        ) {
            return;
        }
        this._explicit = undefined;
        if (
            get(settings.treeFileView) &&
            selection.type === 'waypoint' &&
            selection.waypointIds.length === 1
        ) {
            this.track({ fileId: selection.fileId, id: selection.waypointIds[0] });
        } else {
            this.track(undefined);
        }
    }

    reset() {
        this._explicit = undefined;
        this.track(undefined);
    }

    get waypoint(): WaypointDetails | undefined {
        return get(this._selection)?.waypoint;
    }

    get fileId(): string | undefined {
        return get(this._selection)?.fileId;
    }

    get id(): string | undefined {
        return get(this._selection)?.id;
    }

    private track(target: { fileId: string; id: string } | undefined) {
        this._fileUnsubscribe?.();
        this._fileUnsubscribe = undefined;

        if (!target) {
            this._selection.set(undefined);
            return;
        }

        // read again each time the file changes
        const read = () => {
            const waypoint = engine.waypoint(target.fileId, target.id);
            this._selection.set(waypoint ? { ...target, waypoint } : undefined);
        };
        const file = get(engine.files).get(target.fileId);
        if (file) {
            this._fileUnsubscribe = file.subscribe(read);
        } else {
            read();
        }
    }
}

export const selectedWaypoint = new WaypointSelection();
