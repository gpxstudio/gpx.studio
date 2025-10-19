import { get, writable, type Writable } from 'svelte/store';
import { SelectedGPXFilesObserver, selection } from '$lib/logic/selection';
import { fileStateCollection } from '$lib/logic/file-state';
import {
    ListFileItem,
    ListTrackItem,
    ListTrackSegmentItem,
    ListWaypointItem,
    ListWaypointsItem,
} from '$lib/components/file-list/file-list';

export class AllHidden {
    private _value: Writable<boolean>;

    constructor() {
        this._value = writable(false);
        new SelectedGPXFilesObserver(() => this.update());
    }

    subscribe(run: (value: boolean) => void, invalidate?: () => void) {
        return this._value.subscribe(run, invalidate);
    }

    update() {
        let hidden = true;
        selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            let file = fileStateCollection.getFile(fileId);
            if (file) {
                for (let item of items) {
                    if (!hidden) {
                        return;
                    }

                    if (item instanceof ListFileItem) {
                        hidden = hidden && file._data.hidden === true;
                    } else if (
                        item instanceof ListTrackItem &&
                        item.getTrackIndex() < file.trk.length
                    ) {
                        hidden = hidden && file.trk[item.getTrackIndex()]._data.hidden === true;
                    } else if (
                        item instanceof ListTrackSegmentItem &&
                        item.getTrackIndex() < file.trk.length &&
                        item.getSegmentIndex() < file.trk[item.getTrackIndex()].trkseg.length
                    ) {
                        hidden =
                            hidden &&
                            file.trk[item.getTrackIndex()].trkseg[item.getSegmentIndex()]._data
                                .hidden === true;
                    } else if (item instanceof ListWaypointsItem) {
                        hidden = hidden && file._data.hiddenWpt === true;
                    } else if (
                        item instanceof ListWaypointItem &&
                        item.getWaypointIndex() < file.wpt.length
                    ) {
                        hidden = hidden && file.wpt[item.getWaypointIndex()]._data.hidden === true;
                    }
                }
            }
        });
        if (hidden != get(this._value)) {
            this._value.set(hidden);
        }
    }
}

export const allHidden = new AllHidden();
