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
    extractSelection: () => {
        return fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                if (level === ListLevel.FILE) {
                    let file = fileStateCollection.getFile(fileId);
                    let statistics = fileStateCollection.getStatistics(fileId);
                    if (file && statistics) {
                        if (file.trk.length > 1) {
                            let fileIds = getFileIds(file.trk.length);
                            let closest = file.wpt.map((wpt) =>
                                getClosestTrackSegments(file, statistics, wpt.getCoordinates())
                            );
                            file.trk.forEach((track, index) => {
                                let newFile = file.clone();
                                let tracks = track.trkseg.map((segment, segmentIndex) => {
                                    let t = track.clone();
                                    t.replaceTrackSegments(0, track.trkseg.length - 1, [segment]);
                                    if (track.name) {
                                        t.name = `${track.name} (${segmentIndex + 1})`;
                                    }
                                    return t;
                                });
                                newFile.replaceTracks(0, file.trk.length - 1, tracks);
                                newFile.replaceWaypoints(
                                    0,
                                    file.wpt.length - 1,
                                    file.wpt.filter((wpt, wptIndex) =>
                                        closest[wptIndex].some(
                                            ([trackIndex, segmentIndex]) => trackIndex === index
                                        )
                                    )
                                );
                                newFile._data.id = fileIds[index];
                                newFile.metadata.name =
                                    track.name ?? `${file.metadata.name} (${index + 1})`;
                                draft.set(newFile._data.id, freeze(newFile));
                            });
                        } else if (file.trk.length === 1) {
                            let fileIds = getFileIds(file.trk[0].trkseg.length);
                            let closest = file.wpt.map((wpt) =>
                                getClosestTrackSegments(file, statistics, wpt.getCoordinates())
                            );
                            file.trk[0].trkseg.forEach((segment, index) => {
                                let newFile = file.clone();
                                newFile.replaceTrackSegments(0, 0, file.trk[0].trkseg.length - 1, [
                                    segment,
                                ]);
                                newFile.replaceWaypoints(
                                    0,
                                    file.wpt.length - 1,
                                    file.wpt.filter((wpt, wptIndex) =>
                                        closest[wptIndex].some(
                                            ([trackIndex, segmentIndex]) => segmentIndex === index
                                        )
                                    )
                                );
                                newFile._data.id = fileIds[index];
                                newFile.metadata.name = `${file.trk[0].name ?? file.metadata.name} (${index + 1})`;
                                draft.set(newFile._data.id, freeze(newFile));
                            });
                        }
                        draft.delete(fileId);
                    }
                } else if (level === ListLevel.TRACK) {
                    let file = draft.get(fileId);
                    if (file) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            let track = file.trk[trackIndex];
                            let tracks = track.trkseg.map((segment, segmentIndex) => {
                                let t = track.clone();
                                t.replaceTrackSegments(0, track.trkseg.length - 1, [segment]);
                                if (track.name) {
                                    t.name = `${track.name} (${segmentIndex + 1})`;
                                }
                                return t;
                            });
                            file.replaceTracks(trackIndex, trackIndex, tracks);
                        }
                    }
                }
            });
        });
    },
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
    addElevationToSelection: async () => {
        if (get(selection).size === 0) {
            return;
        }
        let points: (TrackPoint | Waypoint)[] = [];
        selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            let file = fileStateCollection.getFile(fileId);
            if (file) {
                if (level === ListLevel.FILE) {
                    points.push(...file.getTrackPoints());
                    points.push(...file.wpt);
                } else if (level === ListLevel.TRACK) {
                    let trackIndices = items.map((item) => (item as ListTrackItem).getTrackIndex());
                    trackIndices.forEach((trackIndex) => {
                        points.push(...file.trk[trackIndex].getTrackPoints());
                    });
                } else if (level === ListLevel.SEGMENT) {
                    let trackIndex = (items[0] as ListTrackSegmentItem).getTrackIndex();
                    let segmentIndices = items.map((item) =>
                        (item as ListTrackSegmentItem).getSegmentIndex()
                    );
                    segmentIndices.forEach((segmentIndex) => {
                        points.push(...file.trk[trackIndex].trkseg[segmentIndex].getTrackPoints());
                    });
                } else if (level === ListLevel.WAYPOINTS) {
                    points.push(...file.wpt);
                } else if (level === ListLevel.WAYPOINT) {
                    let waypointIndices = items.map((item) =>
                        (item as ListWaypointItem).getWaypointIndex()
                    );
                    points.push(...waypointIndices.map((waypointIndex) => file.wpt[waypointIndex]));
                }
            }
        });
        if (points.length === 0) {
            return;
        }
        getElevation(points).then((elevations) => {
            fileActionManager.applyGlobal((draft) => {
                selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                    let file = draft.get(fileId);
                    if (file) {
                        if (level === ListLevel.FILE) {
                            file.addElevation(elevations);
                        } else if (level === ListLevel.TRACK) {
                            let trackIndices = items.map((item) =>
                                (item as ListTrackItem).getTrackIndex()
                            );
                            file.addElevation(elevations, trackIndices, undefined, []);
                        } else if (level === ListLevel.SEGMENT) {
                            let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                            let segmentIndices = items.map((item) =>
                                (item as ListTrackSegmentItem).getSegmentIndex()
                            );
                            file.addElevation(elevations, trackIndices, segmentIndices, []);
                        } else if (level === ListLevel.WAYPOINTS) {
                            file.addElevation(elevations, [], [], undefined);
                        } else if (level === ListLevel.WAYPOINT) {
                            let waypointIndices = items.map((item) =>
                                (item as ListWaypointItem).getWaypointIndex()
                            );
                            file.addElevation(elevations, [], [], waypointIndices);
                        }
                    }
                });
            });
        });
    },
};
