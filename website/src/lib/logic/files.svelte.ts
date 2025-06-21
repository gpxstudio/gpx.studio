import { updateAnchorPoints } from '$lib/components/toolbar/tools/routing/Simplify';
import { GPXStatisticsTree, type Database } from '$lib/db';
import { liveQuery } from 'dexie';
import { GPXFile } from 'gpx';

class GPXFileState {
    private _db: Database;
    private _file: GPXFile | undefined;

    constructor(db: Database, fileId: string, file: GPXFile) {
        this._db = db;
        this._file = $state(undefined);

        liveQuery(() => db.files.get(fileId)).subscribe((value) => {
            if (value !== undefined) {
                let gpx = new GPXFile(value);
                updateAnchorPoints(gpx);

                let statistics = new GPXStatisticsTree(gpx);
                if (!fileState.has(id)) {
                    // Update the map bounds for new files
                    updateTargetMapBounds(
                        id,
                        statistics.getStatisticsFor(new ListFileItem(id)).global.bounds
                    );
                }

                fileState.set(id, gpx);
                store.set({
                    file: gpx,
                    statistics,
                });

                if (get(selection).hasAnyChildren(new ListFileItem(id))) {
                    updateAllHidden();
                }
            }
        });
    }
}
