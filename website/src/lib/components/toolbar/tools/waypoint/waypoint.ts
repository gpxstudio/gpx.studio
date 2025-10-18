import { ListWaypointItem } from '$lib/components/file-list/file-list';
import { fileStateCollection } from '$lib/logic/file-state';
import { selection } from '$lib/logic/selection';
import { settings } from '$lib/logic/settings';
import type { Waypoint } from 'gpx';
import { get, writable, type Writable } from 'svelte/store';

export class WaypointSelection {
    private _selection: Writable<[Waypoint, string] | undefined>;
    private _fileUnsubscribe: (() => void) | undefined;

    constructor() {
        this._selection = writable(undefined);
        settings.treeFileView.subscribe(() => {
            this.update();
        });
        selection.subscribe(() => {
            this.update();
        });
    }

    subscribe(
        run: (value: [Waypoint, string] | undefined) => void,
        invalidate?: (value?: [Waypoint, string] | undefined) => void
    ) {
        return this._selection.subscribe(run, invalidate);
    }

    set(value: [Waypoint, string] | undefined) {
        this._selection.set(value);
    }

    update() {
        if (this._fileUnsubscribe) {
            this._fileUnsubscribe();
            this._fileUnsubscribe = undefined;
        }
        this._selection.update(() => {
            if (get(settings.treeFileView) && get(selection).size === 1) {
                let item = get(selection).getSelected()[0];
                if (item instanceof ListWaypointItem) {
                    let fileState = fileStateCollection.getFileState(item.getFileId());
                    if (fileState) {
                        let first = true;
                        this._fileUnsubscribe = fileState.subscribe(() => {
                            if (first) first = false;
                            else this.update();
                        });
                        let waypoint = fileState.file?.wpt[item.getWaypointIndex()];
                        if (waypoint) {
                            return [waypoint, item.getFileId()];
                        }
                    }
                }
            }
            return undefined;
        });
    }

    reset() {
        this._selection.set(undefined);
    }

    get wpt(): Waypoint | undefined {
        const selection = get(this._selection);
        return selection ? selection[0] : undefined;
    }

    get fileId(): string | undefined {
        const selection = get(this._selection);
        return selection ? selection[1] : undefined;
    }
}

export const selectedWaypoint = new WaypointSelection();
