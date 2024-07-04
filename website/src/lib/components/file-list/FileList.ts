import { dbUtils, getFile } from "$lib/db";
import { castDraft, freeze } from "immer";
import { GPXFile, Track, TrackSegment, Waypoint } from "gpx";
import { selection } from "./Selection";
import { newGPXFile } from "$lib/stores";

export enum ListLevel {
    ROOT,
    FILE,
    TRACK,
    SEGMENT,
    WAYPOINTS,
    WAYPOINT
}

export const allowedMoves: Record<ListLevel, ListLevel[]> = {
    [ListLevel.ROOT]: [],
    [ListLevel.FILE]: [ListLevel.FILE],
    [ListLevel.TRACK]: [ListLevel.FILE, ListLevel.TRACK],
    [ListLevel.SEGMENT]: [ListLevel.FILE, ListLevel.TRACK, ListLevel.SEGMENT],
    [ListLevel.WAYPOINTS]: [ListLevel.WAYPOINTS],
    [ListLevel.WAYPOINT]: [ListLevel.WAYPOINTS, ListLevel.WAYPOINT]
};

export const allowedPastes: Record<ListLevel, ListLevel[]> = {
    [ListLevel.ROOT]: [],
    [ListLevel.FILE]: [ListLevel.ROOT, ListLevel.FILE],
    [ListLevel.TRACK]: [ListLevel.ROOT, ListLevel.FILE, ListLevel.TRACK],
    [ListLevel.SEGMENT]: [ListLevel.ROOT, ListLevel.FILE, ListLevel.TRACK, ListLevel.SEGMENT],
    [ListLevel.WAYPOINTS]: [ListLevel.FILE, ListLevel.WAYPOINTS, ListLevel.WAYPOINT],
    [ListLevel.WAYPOINT]: [ListLevel.FILE, ListLevel.WAYPOINTS, ListLevel.WAYPOINT]
};

export abstract class ListItem {
    level: ListLevel;

    constructor(level: ListLevel) {
        this.level = level;
    }

    abstract getId(): string | number;
    abstract getFullId(): string;
    abstract getIdAtLevel(level: ListLevel): string | number | undefined;
    abstract getFileId(): string;
    abstract getParent(): ListItem;
    abstract extend(id: string | number): ListItem;
}

export class ListRootItem extends ListItem {
    constructor() {
        super(ListLevel.ROOT);
    }

    getId(): string {
        return 'root';
    }

    getFullId(): string {
        return 'root';
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        return undefined;
    }

    getFileId(): string {
        return '';
    }

    getParent(): ListItem {
        return this;
    }

    extend(id: string): ListFileItem {
        return new ListFileItem(id);
    }
}

export class ListFileItem extends ListItem {
    fileId: string;

    constructor(fileId: string) {
        super(ListLevel.FILE);
        this.fileId = fileId;
    }

    getId(): string {
        return this.fileId;
    }

    getFullId(): string {
        return this.fileId;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case ListLevel.ROOT:
                return this.fileId;
            default:
                return undefined;
        }
    }

    getFileId(): string {
        return this.fileId;
    }

    getParent(): ListItem {
        return new ListRootItem();
    }

    extend(id: number | 'waypoints'): ListTrackItem | ListWaypointsItem {
        if (id === 'waypoints') {
            return new ListWaypointsItem(this.fileId);
        } else {
            return new ListTrackItem(this.fileId, id);
        }
    }
}

export class ListTrackItem extends ListItem {
    fileId: string;
    trackIndex: number;

    constructor(fileId: string, trackIndex: number) {
        super(ListLevel.TRACK);
        this.fileId = fileId;
        this.trackIndex = trackIndex;
    }

    getId(): number {
        return this.trackIndex;
    }

    getFullId(): string {
        return `${this.fileId}-track-${this.trackIndex}`;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case ListLevel.ROOT:
                return this.fileId;
            case ListLevel.FILE:
                return this.trackIndex;
            default:
                return undefined;
        }
    }

    getFileId(): string {
        return this.fileId;
    }

    getTrackIndex(): number {
        return this.trackIndex;
    }

    getParent(): ListItem {
        return new ListFileItem(this.fileId);
    }

    extend(id: number): ListTrackSegmentItem {
        return new ListTrackSegmentItem(this.fileId, this.trackIndex, id);
    }
}

export class ListTrackSegmentItem extends ListItem {
    fileId: string;
    trackIndex: number;
    segmentIndex: number;

    constructor(fileId: string, trackIndex: number, segmentIndex: number) {
        super(ListLevel.SEGMENT);
        this.fileId = fileId;
        this.trackIndex = trackIndex;
        this.segmentIndex = segmentIndex;
    }

    getId(): number {
        return this.segmentIndex;
    }

    getFullId(): string {
        return `${this.fileId}-track-${this.trackIndex}--${this.segmentIndex}`;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case ListLevel.ROOT:
                return this.fileId;
            case ListLevel.FILE:
                return this.trackIndex;
            case ListLevel.TRACK:
                return this.segmentIndex;
            default:
                return undefined;
        }
    }

    getFileId(): string {
        return this.fileId;
    }

    getTrackIndex(): number {
        return this.trackIndex;
    }

    getSegmentIndex(): number {
        return this.segmentIndex;
    }

    getParent(): ListItem {
        return new ListTrackItem(this.fileId, this.trackIndex);
    }

    extend(): ListTrackSegmentItem {
        return this;
    }
}

export class ListWaypointsItem extends ListItem {
    fileId: string;

    constructor(fileId: string) {
        super(ListLevel.WAYPOINTS);
        this.fileId = fileId;
    }

    getId(): string {
        return 'waypoints';
    }

    getFullId(): string {
        return `${this.fileId}-waypoints`;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case ListLevel.ROOT:
                return this.fileId;
            case ListLevel.FILE:
                return 'waypoints';
            default:
                return undefined;
        }
    }

    getFileId(): string {
        return this.fileId;
    }

    getParent(): ListItem {
        return new ListFileItem(this.fileId);
    }

    extend(id: number): ListWaypointItem {
        return new ListWaypointItem(this.fileId, id);
    }
}

export class ListWaypointItem extends ListItem {
    fileId: string;
    waypointIndex: number;

    constructor(fileId: string, waypointIndex: number) {
        super(ListLevel.WAYPOINT);
        this.fileId = fileId;
        this.waypointIndex = waypointIndex;
    }

    getId(): number {
        return this.waypointIndex;
    }

    getFullId(): string {
        return `${this.fileId}-waypoint-${this.waypointIndex}`;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case ListLevel.ROOT:
                return this.fileId;
            case ListLevel.FILE:
                return 'waypoints';
            case ListLevel.WAYPOINTS:
                return this.waypointIndex;
            default:
                return undefined;
        }
    }

    getFileId(): string {
        return this.fileId;
    }

    getWaypointIndex(): number {
        return this.waypointIndex;
    }

    getParent(): ListItem {
        return new ListWaypointsItem(this.fileId);
    }

    extend(): ListWaypointItem {
        return this;
    }
}

export function sortItems(items: ListItem[], reverse: boolean = false) {
    items.sort((a, b) => {
        if (a instanceof ListTrackItem && b instanceof ListTrackItem) {
            return a.getTrackIndex() - b.getTrackIndex();
        } else if (a instanceof ListTrackSegmentItem && b instanceof ListTrackSegmentItem) {
            return a.getSegmentIndex() - b.getSegmentIndex();
        } else if (a instanceof ListWaypointItem && b instanceof ListWaypointItem) {
            return a.getWaypointIndex() - b.getWaypointIndex();
        }
        return a.level - b.level;
    });
    if (reverse) {
        items.reverse();
    }
}

export function moveItems(fromParent: ListItem, toParent: ListItem, fromItems: ListItem[], toItems: ListItem[], remove: boolean = true) {
    if (fromItems.length === 0) {
        return;
    }

    sortItems(fromItems, remove && !(fromParent instanceof ListRootItem));
    sortItems(toItems, false);

    let context: (GPXFile | Track | TrackSegment | Waypoint[] | Waypoint)[] = [];
    if (!remove || fromParent instanceof ListRootItem) {
        fromItems.forEach((item) => {
            let file = getFile(item.getFileId());
            if (file) {
                if (item instanceof ListFileItem) {
                    context.push(file.clone());
                } else if (item instanceof ListTrackItem && item.getTrackIndex() < file.trk.length) {
                    context.push(file.trk[item.getTrackIndex()].clone());
                } else if (item instanceof ListTrackSegmentItem && item.getTrackIndex() < file.trk.length && item.getSegmentIndex() < file.trk[item.getTrackIndex()].trkseg.length) {
                    context.push(file.trk[item.getTrackIndex()].trkseg[item.getSegmentIndex()].clone());
                } else if (item instanceof ListWaypointsItem) {
                    context.push(file.wpt.map((wpt) => wpt.clone()));
                } else if (item instanceof ListWaypointItem && item.getWaypointIndex() < file.wpt.length) {
                    context.push(file.wpt[item.getWaypointIndex()].clone());
                }
            }
        });
    }

    let files = [fromParent.getFileId(), toParent.getFileId()];
    let callbacks = [
        (file, context: (GPXFile | Track | TrackSegment | Waypoint[] | Waypoint)[]) => {
            fromItems.forEach((item) => {
                if (item instanceof ListTrackItem) {
                    context.push(...file.replaceTracks(item.getTrackIndex(), item.getTrackIndex(), []));
                } else if (item instanceof ListTrackSegmentItem) {
                    context.push(...file.replaceTrackSegments(item.getTrackIndex(), item.getSegmentIndex(), item.getSegmentIndex(), []));
                } else if (item instanceof ListWaypointsItem) {
                    context.push(file.replaceWaypoints(0, newFile.wpt.length - 1, []));
                } else if (item instanceof ListWaypointItem) {
                    context.push(...file.replaceWaypoints(item.getWaypointIndex(), item.getWaypointIndex(), []));
                }
            });
            context.reverse();
        },
        (file, context: (GPXFile | Track | TrackSegment | Waypoint[] | Waypoint)[]) => {
            toItems.forEach((item, i) => {
                if (item instanceof ListTrackItem) {
                    if (context[i] instanceof Track) {
                        file.replaceTracks(item.getTrackIndex(), item.getTrackIndex() - 1, [context[i]]);
                    } else if (context[i] instanceof TrackSegment) {
                        file.replaceTracks(item.getTrackIndex(), item.getTrackIndex() - 1, [new Track({
                            trkseg: [context[i]]
                        })]);
                    }
                } else if (item instanceof ListTrackSegmentItem && context[i] instanceof TrackSegment) {
                    file.replaceTrackSegments(item.getTrackIndex(), item.getSegmentIndex(), item.getSegmentIndex() - 1, [context[i]]);
                } else if (item instanceof ListWaypointsItem) {
                    if (Array.isArray(context[i]) && context[i].length > 0 && context[i][0] instanceof Waypoint) {
                        file.replaceWaypoints(file.wpt.length, file.wpt.length - 1, context[i]);
                    } else if (context[i] instanceof Waypoint) {
                        file.replaceWaypoints(file.wpt.length, file.wpt.length - 1, [context[i]]);
                    }
                } else if (item instanceof ListWaypointItem && context[i] instanceof Waypoint) {
                    file.replaceWaypoints(item.getWaypointIndex(), item.getWaypointIndex() - 1, [context[i]]);
                }
            });
        }
    ];

    if (fromParent instanceof ListRootItem) {
        files = [];
        callbacks = [];
    } else if (!remove) {
        files.splice(0, 1);
        callbacks.splice(0, 1);
    }

    dbUtils.applyEachToFilesAndGlobal(files, callbacks, (files, context: (GPXFile | Track | TrackSegment | Waypoint[] | Waypoint)[]) => {
        toItems.forEach((item, i) => {
            if (item instanceof ListFileItem) {
                if (context[i] instanceof GPXFile) {
                    let newFile = context[i];
                    if (remove) {
                        files.delete(newFile._data.id);
                    }
                    newFile._data.id = item.getFileId();
                    files.set(item.getFileId(), freeze(newFile));
                } else if (context[i] instanceof Track) {
                    let newFile = newGPXFile();
                    newFile._data.id = item.getFileId();
                    if (context[i].name) {
                        newFile.metadata.name = context[i].name;
                    }
                    console.log(context[i]);
                    newFile.replaceTracks(0, 0, [context[i]])[0];
                    files.set(item.getFileId(), freeze(newFile));
                } else if (context[i] instanceof TrackSegment) {
                    let newFile = newGPXFile();
                    newFile._data.id = item.getFileId();
                    newFile.replaceTracks(0, 0, [new Track({
                        trkseg: [context[i]]
                    })])[0];
                    files.set(item.getFileId(), freeze(newFile));
                }
            }
        });
    }, context);

    selection.update(($selection) => {
        $selection.clear();
        toItems.forEach((item) => {
            $selection.set(item, true);
        });
        return $selection;
    });
}
