import { fileStateCollection } from '$lib/logic/file-state';
import { fileActionManager } from '$lib/logic/file-action-manager';
import { applyToOrderedItemsFromFile, copied, cut, selection } from '$lib/logic/selection';
import { currentTool, Tool } from '$lib/components/toolbar/tools';
import { SplitType } from '$lib/components/toolbar/tools/scissors/scissors';
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
    type Coordinates,
    type LineStyleExtension,
    type WaypointType,
} from 'gpx';
import { get } from 'svelte/store';
import { settings } from '$lib/logic/settings';
import { getClosestLinePoint, getClosestTrackSegments, getElevation } from '$lib/utils';
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
    add: (file: GPXFile) => {
        if (file._data.id === undefined) {
            file._data.id = getFileIds(1)[0];
        }
        return fileActionManager.applyGlobal((draft) => {
            draft.set(file._data.id, freeze(file));
        });
    },
    addMultiple: (files: GPXFile[]) => {
        let ids = getFileIds(files.length);
        fileActionManager.applyGlobal((draft) => {
            files.forEach((file, index) => {
                file._data.id = ids[index];
                draft.set(file._data.id, freeze(file));
            });
        });
        return ids;
    },
    duplicateSelection: () => {
        if (get(selection).size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            let ids = getFileIds(get(settings.fileOrder).length);
            let index = 0;
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                if (level === ListLevel.FILE) {
                    let file = fileStateCollection.getFile(fileId);
                    if (file) {
                        let newFile = file.clone();
                        newFile._data.id = ids[index++];
                        draft.set(newFile._data.id, freeze(newFile));
                    }
                } else {
                    let file = draft.get(fileId);
                    if (file) {
                        if (level === ListLevel.TRACK) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                file.replaceTracks(trackIndex + 1, trackIndex, [
                                    file.trk[trackIndex].clone(),
                                ]);
                            }
                        } else if (level === ListLevel.SEGMENT) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                file.replaceTrackSegments(
                                    trackIndex,
                                    segmentIndex + 1,
                                    segmentIndex,
                                    [file.trk[trackIndex].trkseg[segmentIndex].clone()]
                                );
                            }
                        } else if (level === ListLevel.WAYPOINTS) {
                            file.replaceWaypoints(
                                file.wpt.length,
                                file.wpt.length - 1,
                                file.wpt.map((wpt) => wpt.clone())
                            );
                        } else if (level === ListLevel.WAYPOINT) {
                            for (let item of items) {
                                let waypointIndex = (item as ListWaypointItem).getWaypointIndex();
                                file.replaceWaypoints(waypointIndex + 1, waypointIndex, [
                                    file.wpt[waypointIndex].clone(),
                                ]);
                            }
                        }
                    }
                }
            });
        });
    },
    addNewTrack: (fileId: string) => {
        fileActionManager.applyToFile(fileId, (file) =>
            file.replaceTracks(file.trk.length, file.trk.length, [new Track()])
        );
    },
    addNewSegment: (fileId: string, trackIndex: number) => {
        fileActionManager.applyToFile(fileId, (file) => {
            let track = file.trk[trackIndex];
            track.replaceTrackSegments(track.trkseg.length, track.trkseg.length, [
                new TrackSegment(),
            ]);
        });
    },
    reverseSelection: () => {
        if (
            !get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints']) ||
            get(gpxStatistics).global.length <= 1
        ) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.reverse();
                    } else if (level === ListLevel.TRACK) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            file.reverseTrack(trackIndex);
                        }
                    } else if (level === ListLevel.SEGMENT) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                            let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                            file.reverseTrackSegment(trackIndex, segmentIndex);
                        }
                    }
                }
            });
        });
    },
    createRoundTripForSelection() {
        if (!get(selection).hasAnyChildren(new ListRootItem(), true, ['waypoints'])) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.roundTrip();
                    } else if (level === ListLevel.TRACK) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackItem).getTrackIndex();
                            file.roundTripTrack(trackIndex);
                        }
                    } else if (level === ListLevel.SEGMENT) {
                        for (let item of items) {
                            let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                            let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                            file.roundTripTrackSegment(trackIndex, segmentIndex);
                        }
                    }
                }
            });
        });
    },
    mergeSelection: (mergeTraces: boolean, removeGaps: boolean) => {
        fileActionManager.applyGlobal((draft) => {
            let first = true;
            let target: ListItem = new ListRootItem();
            let targetFile: GPXFile | undefined = undefined;
            let toMerge: {
                trk: Track[];
                trkseg: TrackSegment[];
                wpt: Waypoint[];
            } = {
                trk: [],
                trkseg: [],
                wpt: [],
            };
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                let originalFile = fileStateCollection.getFile(fileId);
                if (file && originalFile) {
                    if (level === ListLevel.FILE) {
                        toMerge.trk.push(...originalFile.trk.map((track) => track.clone()));
                        for (const wpt of originalFile.wpt) {
                            if (!toMerge.wpt.some((w) => w.equals(wpt))) {
                                toMerge.wpt.push(wpt.clone());
                            }
                        }
                        if (first) {
                            target = items[0];
                            targetFile = file;
                        } else {
                            draft.delete(fileId);
                        }
                    } else {
                        if (level === ListLevel.TRACK) {
                            items.forEach((item, index) => {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                toMerge.trkseg.splice(
                                    0,
                                    0,
                                    ...originalFile.trk[trackIndex].trkseg.map((segment) =>
                                        segment.clone()
                                    )
                                );
                                if (index === items.length - 1) {
                                    // Order is reversed, so the last track is the first one and the one to keep
                                    target = item;
                                    file.trk[trackIndex].trkseg = [];
                                } else {
                                    file.trk.splice(trackIndex, 1);
                                }
                            });
                        } else if (level === ListLevel.SEGMENT) {
                            items.forEach((item, index) => {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                if (index === items.length - 1) {
                                    // Order is reversed, so the last segment is the first one and the one to keep
                                    target = item;
                                }
                                toMerge.trkseg.splice(
                                    0,
                                    0,
                                    originalFile.trk[trackIndex].trkseg[segmentIndex].clone()
                                );
                                file.trk[trackIndex].trkseg.splice(segmentIndex, 1);
                            });
                        }
                        targetFile = file;
                    }
                    first = false;
                }
            });
            if (mergeTraces) {
                let statistics = get(gpxStatistics);
                let speed =
                    statistics.global.speed.moving > 0 ? statistics.global.speed.moving : undefined;
                let startTime: Date | undefined = undefined;
                if (speed !== undefined) {
                    if (
                        statistics.global.length > 0 &&
                        statistics.getTrackPoint(0)!.trkpt.time !== undefined
                    ) {
                        startTime = statistics.getTrackPoint(0)!.trkpt.time;
                    } else {
                        for (let i = 0; i < statistics.global.length; i++) {
                            const point = statistics.getTrackPoint(i)!;
                            if (point.trkpt.time !== undefined) {
                                startTime = new Date(
                                    point.trkpt.time.getTime() -
                                        (1000 * 3600 * point.distance.total) / speed
                                );
                                break;
                            }
                        }
                    }
                }
                if (toMerge.trk.length > 0 && toMerge.trk[0].trkseg.length > 0) {
                    let s = new TrackSegment();
                    toMerge.trk.map((track) => {
                        track.trkseg.forEach((segment) => {
                            s.replaceTrackPoints(
                                s.trkpt.length,
                                s.trkpt.length,
                                segment.trkpt.slice(),
                                speed,
                                startTime,
                                removeGaps
                            );
                        });
                    });
                    toMerge.trk = [toMerge.trk[0]];
                    toMerge.trk[0].trkseg = [s];
                }
                if (toMerge.trkseg.length > 0) {
                    let s = new TrackSegment();
                    toMerge.trkseg.forEach((segment) => {
                        s.replaceTrackPoints(
                            s.trkpt.length,
                            s.trkpt.length,
                            segment.trkpt.slice(),
                            speed,
                            startTime,
                            removeGaps
                        );
                    });
                    toMerge.trkseg = [s];
                }
            }
            if (targetFile) {
                targetFile = targetFile as GPXFile;
                if (target instanceof ListFileItem) {
                    targetFile.replaceTracks(0, targetFile.trk.length - 1, toMerge.trk);
                    targetFile.replaceWaypoints(0, targetFile.wpt.length - 1, toMerge.wpt);
                } else if (target instanceof ListTrackItem) {
                    let trackIndex = target.getTrackIndex();
                    targetFile.replaceTrackSegments(trackIndex, 0, -1, toMerge.trkseg);
                } else if (target instanceof ListTrackSegmentItem) {
                    let trackIndex = target.getTrackIndex();
                    let segmentIndex = target.getSegmentIndex();
                    targetFile.replaceTrackSegments(
                        trackIndex,
                        segmentIndex,
                        segmentIndex - 1,
                        toMerge.trkseg
                    );
                }
            }
        });
    },
    cropSelection: (start: number, end: number) => {
        if (get(selection).size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        let length = file.getNumberOfTrackPoints();
                        if (start >= length || end < 0) {
                            draft.delete(fileId);
                        } else if (start > 0 || end < length - 1) {
                            file.crop(Math.max(0, start), Math.min(length - 1, end));
                        }
                        start -= length;
                        end -= length;
                    } else if (level === ListLevel.TRACK) {
                        let trackIndices = items.map((item) =>
                            (item as ListTrackItem).getTrackIndex()
                        );
                        file.crop(start, end, trackIndices);
                    } else if (level === ListLevel.SEGMENT) {
                        let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                        let segmentIndices = items.map((item) =>
                            (item as ListTrackSegmentItem).getSegmentIndex()
                        );
                        file.crop(start, end, trackIndices, segmentIndices);
                    }
                }
            }, false);
        });
    },
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
    split(
        splitType: SplitType,
        fileId: string,
        trackIndex: number,
        segmentIndex: number,
        coordinates: Coordinates,
        trkptIndex?: number
    ) {
        return fileActionManager.applyGlobal((draft) => {
            let file = fileStateCollection.getFile(fileId);
            if (file) {
                let segment = file.trk[trackIndex].trkseg[segmentIndex];
                let minIndex = 0;
                if (trkptIndex === undefined) {
                    // Find the point closest to split
                    let closest = getClosestLinePoint(segment.trkpt, coordinates);
                    minIndex = closest._data.index;
                } else {
                    minIndex = trkptIndex;
                }
                let absoluteIndex = minIndex;
                file.forEachSegment((seg, trkIndex, segIndex) => {
                    if (
                        (trkIndex < trackIndex && splitType === SplitType.FILES) ||
                        (trkIndex === trackIndex && segIndex < segmentIndex)
                    ) {
                        absoluteIndex += seg.trkpt.length;
                    }
                });
                if (splitType === SplitType.FILES) {
                    let newFile = draft.get(fileId);
                    if (newFile) {
                        newFile.crop(0, absoluteIndex);
                        let newFile2 = file.clone();
                        newFile2._data.id = getFileIds(1)[0];
                        newFile2.crop(absoluteIndex, file.getNumberOfTrackPoints() - 1);
                        draft.set(newFile2._data.id, freeze(newFile2));
                    }
                } else if (splitType === SplitType.TRACKS) {
                    let newFile = draft.get(fileId);
                    if (newFile) {
                        let start = file.trk[trackIndex].clone();
                        start.crop(0, absoluteIndex);
                        let end = file.trk[trackIndex].clone();
                        end.crop(absoluteIndex, file.trk[trackIndex].getNumberOfTrackPoints() - 1);
                        newFile.replaceTracks(trackIndex, trackIndex, [start, end]);
                    }
                } else if (splitType === SplitType.SEGMENTS) {
                    let newFile = draft.get(fileId);
                    if (newFile) {
                        let start = segment.clone();
                        start.crop(0, minIndex);
                        let end = segment.clone();
                        end.crop(minIndex, segment.trkpt.length - 1);
                        newFile.replaceTrackSegments(trackIndex, segmentIndex, segmentIndex, [
                            start,
                            end,
                        ]);
                    }
                }
            }
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
    addOrUpdateWaypoint: (waypoint: WaypointType, item?: ListWaypointItem) => {
        getElevation([waypoint.attributes]).then((elevation) => {
            if (item) {
                fileActionManager.applyToFile(item.getFileId(), (file) => {
                    let wpt = file.wpt[item.getWaypointIndex()];
                    wpt.name = waypoint.name;
                    wpt.desc = waypoint.desc;
                    wpt.cmt = waypoint.cmt;
                    wpt.sym = waypoint.sym;
                    wpt.link = waypoint.link;
                    wpt.setCoordinates(waypoint.attributes);
                    wpt.ele = elevation[0];
                });
            } else {
                let fileIds = new Set<string>();
                get(selection)
                    .getSelected()
                    .forEach((item) => {
                        fileIds.add(item.getFileId());
                    });
                let wpt = new Waypoint(waypoint);
                wpt.ele = elevation[0];
                fileActionManager.applyToFiles(Array.from(fileIds), (file) =>
                    file.replaceWaypoints(file.wpt.length, file.wpt.length, [wpt])
                );
            }
        });
    },
    deleteWaypoint: (fileId: string, waypointIndex: number) => {
        fileActionManager.applyToFile(fileId, (file) =>
            file.replaceWaypoints(waypointIndex, waypointIndex, [])
        );
    },
    setStyleToSelection: (style: LineStyleExtension) => {
        if (get(selection).size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file && (level === ListLevel.FILE || level === ListLevel.TRACK)) {
                    if (level === ListLevel.FILE) {
                        file.setStyle(style);
                    } else if (level === ListLevel.TRACK) {
                        if (items.length === file.trk.length) {
                            file.setStyle(style);
                        } else {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                file.trk[trackIndex].setStyle(style);
                            }
                        }
                    }
                }
            });
        });
    },
    setHiddenToSelection: (hidden: boolean) => {
        if (get(selection).size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                let file = draft.get(fileId);
                if (file) {
                    if (level === ListLevel.FILE) {
                        file.setHidden(hidden);
                    } else if (level === ListLevel.TRACK) {
                        let trackIndices = items.map((item) =>
                            (item as ListTrackItem).getTrackIndex()
                        );
                        file.setHidden(hidden, trackIndices);
                    } else if (level === ListLevel.SEGMENT) {
                        let trackIndices = [(items[0] as ListTrackSegmentItem).getTrackIndex()];
                        let segmentIndices = items.map((item) =>
                            (item as ListTrackSegmentItem).getSegmentIndex()
                        );
                        file.setHidden(hidden, trackIndices, segmentIndices);
                    } else if (level === ListLevel.WAYPOINTS) {
                        file.setHiddenWaypoints(hidden);
                    } else if (level === ListLevel.WAYPOINT) {
                        let waypointIndices = items.map((item) =>
                            (item as ListWaypointItem).getWaypointIndex()
                        );
                        file.setHiddenWaypoints(hidden, waypointIndices);
                    }
                }
            });
        });
    },
    deleteSelection: () => {
        if (get(selection).size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                if (level === ListLevel.FILE) {
                    draft.delete(fileId);
                } else {
                    let file = draft.get(fileId);
                    if (file) {
                        if (level === ListLevel.TRACK) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackItem).getTrackIndex();
                                file.replaceTracks(trackIndex, trackIndex, []);
                            }
                        } else if (level === ListLevel.SEGMENT) {
                            for (let item of items) {
                                let trackIndex = (item as ListTrackSegmentItem).getTrackIndex();
                                let segmentIndex = (item as ListTrackSegmentItem).getSegmentIndex();
                                file.replaceTrackSegments(
                                    trackIndex,
                                    segmentIndex,
                                    segmentIndex,
                                    []
                                );
                            }
                        } else if (level === ListLevel.WAYPOINTS) {
                            file.replaceWaypoints(0, file.wpt.length - 1, []);
                        } else if (level === ListLevel.WAYPOINT) {
                            for (let item of items) {
                                let waypointIndex = (item as ListWaypointItem).getWaypointIndex();
                                file.replaceWaypoints(waypointIndex, waypointIndex, []);
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
    deleteSelectedFiles: () => {
        if (get(selection).size === 0) {
            return;
        }
        fileActionManager.applyGlobal((draft) => {
            selection.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
                draft.delete(fileId);
            });
        });
    },
    deleteAllFiles: () => {
        fileActionManager.applyGlobal((draft) => {
            draft.clear();
        });
    },
};
