import { selection } from '$lib/logic/selection';
import { GPXStatistics } from 'gpx';
import { fileStateCollection, GPXFileState } from '$lib/logic/file-state';
import {
    ListFileItem,
    ListWaypointItem,
    ListWaypointsItem,
} from '$lib/components/file-list/file-list';
import { get, writable, type Writable } from 'svelte/store';
import { settings } from '$lib/logic/settings';

const { fileOrder } = settings;

export class SelectedGPXStatistics {
    private _statistics: Writable<GPXStatistics>;
    private _files: Map<
        string,
        {
            file: GPXFileState;
            unsubscribe: () => void;
        }
    >;

    constructor() {
        this._statistics = writable(new GPXStatistics());
        this._files = new Map();
        selection.subscribe(() => this.update());
        fileOrder.subscribe(() => this.update());
    }

    subscribe(run: (value: GPXStatistics) => void, invalidate?: (value?: GPXStatistics) => void) {
        return this._statistics.subscribe(run, invalidate);
    }

    update() {
        let statistics = new GPXStatistics();
        selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            let stats = fileStateCollection.getStatistics(fileId);
            if (stats) {
                let first = true;
                items.forEach((item) => {
                    if (
                        !(item instanceof ListWaypointItem || item instanceof ListWaypointsItem) ||
                        first
                    ) {
                        statistics.mergeWith(stats.getStatisticsFor(item));
                        first = false;
                    }
                });
            }

            if (!this._files.has(fileId)) {
                let file = fileStateCollection.getFileState(fileId);
                if (file) {
                    let first = true;
                    let unsubscribe = file.subscribe(() => {
                        if (first) first = false;
                        else this.update();
                    });
                    this._files.set(fileId, { file, unsubscribe });
                }
            }
        }, false);
        this._statistics.set(statistics);
        for (let [fileId, entry] of this._files) {
            if (
                !get(fileStateCollection).has(fileId) ||
                !get(selection).hasAnyChildren(new ListFileItem(fileId))
            ) {
                entry.unsubscribe();
                this._files.delete(fileId);
            }
        }
    }
}

export const gpxStatistics = new SelectedGPXStatistics();

export const slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined> =
    writable(undefined);

gpxStatistics.subscribe(() => {
    slicedGPXStatistics.set(undefined);
});
