import { ListWaypointItem } from '$lib/components/file-list/file-list';
import { fileStateCollection } from '$lib/logic/file-state.svelte';
import { selection } from '$lib/logic/selection.svelte';
import { settings } from '$lib/logic/settings.svelte';
import type { Waypoint } from 'gpx';

export class WaypointSelection {
    private _selection: [Waypoint, string] | undefined;

    constructor() {
        this._selection = $derived.by(() => {
            if (settings.treeFileView.value && selection.value.size === 1) {
                let item = selection.value.getSelected()[0];
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
        this._selection = undefined;
    }

    get wpt(): Waypoint | undefined {
        return this._selection ? this._selection[0] : undefined;
    }

    get fileId(): string | undefined {
        return this._selection ? this._selection[1] : undefined;
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
