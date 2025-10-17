import { ListWaypointItem } from '$lib/components/file-list/file-list';
import { fileStateCollection } from '$lib/logic/file-state';
import { selection } from '$lib/logic/selection';
import { settings } from '$lib/logic/settings';
import type { Waypoint } from 'gpx';
import { get, writable, type Writable } from 'svelte/store';

export class WaypointSelection {
    private _selection: Writable<[Waypoint, string] | undefined>;

    constructor() {
        this._selection = writable(undefined);
        settings.treeFileView.subscribe(() => {
            this.update();
        });
        selection.subscribe(() => {
            this.update();
        });
    }

    update() {
        this._selection.update(() => {
            if (get(settings.treeFileView) && get(selection).size === 1) {
                let item = get(selection).getSelected()[0];
                if (item instanceof ListWaypointItem) {
                    let file = fileStateCollection.getFile(item.getFileId());
                    let waypoint = file?.wpt[item.getWaypointIndex()];
                    if (waypoint) {
                        return [waypoint, item.getFileId()];
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

    // TODO update the waypoint data if the file changes
    // function updateWaypointData(fileStore: GPXFileWithStatistics | undefined) {
    //     if (selectedWaypoint.wpt) {
    //         if (fileStore) {
    //             if ($selectedWaypoint[0]._data.index < fileStore.file.wpt.length) {
    //                 $selectedWaypoint[0] = fileStore.file.wpt[$selectedWaypoint[0]._data.index];
    //                 name = $selectedWaypoint[0].name ?? '';
    //                 description = $selectedWaypoint[0].desc ?? '';
    //                 if (
    //                     $selectedWaypoint[0].cmt !== undefined &&
    //                     $selectedWaypoint[0].cmt !== $selectedWaypoint[0].desc
    //                 ) {
    //                     description += '\n\n' + $selectedWaypoint[0].cmt;
    //                 }
    //                 link = $selectedWaypoint[0].link?.attributes?.href ?? '';
    //                 let symbol = $selectedWaypoint[0].sym ?? '';
    //                 symbolKey = getSymbolKey(symbol) ?? symbol ?? '';
    //                 longitude = parseFloat($selectedWaypoint[0].getLongitude().toFixed(6));
    //                 latitude = parseFloat($selectedWaypoint[0].getLatitude().toFixed(6));
    //             } else {
    //                 selectedWaypoint.reset();
    //             }
    //         } else {
    //             selectedWaypoint.reset();
    //         }
    //     }
    // }
}

export const selectedWaypoint = new WaypointSelection();
