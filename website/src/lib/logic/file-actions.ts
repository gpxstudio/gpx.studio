import { fileStateCollection } from '$lib/logic/file-state';
import { fileActionManager } from '$lib/logic/file-action-manager';
import { applyToOrderedItemsFromFile, copied, cut, selection } from '$lib/logic/selection';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import {
    ListFileItem,
    ListLevel,
    ListRootItem,
    ListTrackItem,
    ListTrackSegmentItem,
    ListWaypointItem,
    type ListItem,
} from '$lib/components/file-list/file-list';
import { i18n } from '$lib/i18n.svelte';
import { freeze } from 'immer';
import {
    GPXFile,
    Track,
    TrackPoint,
    TrackSegment,
    Waypoint,
    type LineStyleExtension,
    type WaypointType,
} from 'gpx';
import { get } from 'svelte/store';
import { settings } from '$lib/logic/settings';
import { getClosestTrackSegments, getElevation } from '$lib/utils';
import { gpxStatistics } from '$lib/logic/statistics';
import { boundsManager } from './bounds';
import { engine } from '$lib/engine';
import { defaultFileName } from '$lib/default-file-name';

// Generate unique file ids, different from the ones in the database
export function getFileIds(n: number) {
    let ids = [];
    for (let index = 0; ids.length < n; index++) {
        let id = `gpx-${index}`;
        if (!fileStateCollection.getFile(id)) {
            ids.push(id);
        }
    }
    return ids;
}

/** The name of a new file: the translated default name, numbered if other files have it. */
export function newFileName() {
    const names = [...get(engine.files).values()].map((file) => get(file).structure.name);
    return defaultFileName(i18n._('menu.new_file'), names);
}

export function newGPXFile() {
    let file = new GPXFile();
    file.metadata.name = newFileName();
    return file;
}

export function createFile() {
    // the engine selects the new file
    engine.newFile(newFileName());
    currentTool.set(Tool.ROUTING);
}

export function triggerFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gpx';
    input.multiple = true;
    input.className = 'hidden';
    input.onchange = () => {
        if (input.files) {
            loadFiles(input.files);
        }
    };
    input.click();
}

/**
 * Loads GPX files in the engine, as a single command: one undo step, the first file that could be
 * read is selected, and the map fits the files. A file without name is named like the file on
 * disk. Returns the ids of the files that were added.
 */
export async function loadFiles(list: FileList | File[]): Promise<string[]> {
    const files = await Promise.all(
        Array.from(list).map(async (file) => ({
            data: new Uint8Array(await file.arrayBuffer()),
            name: file.name.split('.').slice(0, -1).join('.'),
        }))
    );

    const before = new Set(get(engine.order));
    await engine.loadFiles(files);

    const ids = get(engine.order).filter((id) => !before.has(id));
    if (ids.length > 0) {
        boundsManager.fitBoundsOnLoad(ids);
    }
    return ids;
}

// Helper functions for file operations
export const fileActions = {
    reduce: (itemsAndPoints: Map<ListItem, TrackPoint[]>) => {
        if (itemsAndPoints.size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            let allItems = Array.from(itemsAndPoints.keys());
            applyToOrderedItemsFromFile(allItems, (fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    for (let item of items) {
                        if (item instanceof ListTrackSegmentItem) {
                            let trackIndex = item.getTrackIndex();
                            let segmentIndex = item.getSegmentIndex();
                            let points = itemsAndPoints.get(item);
                            if (points) {
                                file.replaceTrackPoints(
                                    trackIndex,
                                    segmentIndex,
                                    0,
                                    file.trk[trackIndex].trkseg[
                                        segmentIndex
                                    ].getNumberOfTrackPoints() - 1,
                                    points
                                );
                            }
                        }
                    }
                }
            });
        });
    },
};
