import { dbUtils, fileObservers } from "$lib/db";
import { castDraft } from "immer";
import { Track, TrackSegment, Waypoint } from "gpx";
import { selection } from "./Selection";
import { get } from "svelte/store";

export enum ListLevel {
    ROOT,
    FILE,
    TRACK,
    SEGMENT,
    WAYPOINTS,
    WAYPOINT
}

export abstract class ListItem {
    level: ListLevel;

    constructor(level: ListLevel) {
        this.level = level;
    }

    abstract getId(): string | number;
    abstract getIdAtLevel(level: ListLevel): string | number | undefined;
    abstract getFileId(): string;
    abstract extend(id: string | number): ListItem;
}

export class ListRootItem extends ListItem {
    constructor() {
        super(ListLevel.ROOT);
    }

    getId(): string {
        return 'root';
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        return undefined;
    }

    getFileId(): string {
        return '';
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

export function moveItems(fromParent: ListItem, toParent: ListItem, fromItems: ListItem[], toItems: ListItem[]) {
    sortItems(fromItems, true);
    sortItems(toItems, false);

    let toFileObserver = get(fileObservers).get(toParent.getFileId());
    let first = true;
    toFileObserver?.subscribe(() => { // Update selection when the target file has been updated
        if (first) first = false;
        else {
            selection.update(($selection) => {
                $selection.clear();
                toItems.forEach((item) => {
                    $selection.set(item, true);
                });
                return $selection;
            });
        }
    });

    dbUtils.applyEachToFiles([fromParent.getFileId(), toParent.getFileId()], [
        (file, context: (Track | TrackSegment | Waypoint[] | Waypoint)[]) => {
            let newFile = file;
            fromItems.forEach((item) => {
                if (item instanceof ListTrackItem) {
                    let [result, removed] = newFile.replaceTracks(item.getTrackIndex(), item.getTrackIndex(), []);
                    newFile = castDraft(result);
                    context.push(...removed);
                } else if (item instanceof ListTrackSegmentItem) {
                    let [result, removed] = newFile.replaceTrackSegments(item.getTrackIndex(), item.getSegmentIndex(), item.getSegmentIndex(), []);
                    newFile = castDraft(result);
                    context.push(...removed);
                } else if (item instanceof ListWaypointsItem) {
                    let [result, removed] = newFile.replaceWaypoints(0, newFile.wpt.length - 1, []);
                    newFile = castDraft(result);
                    context.push(removed);
                } else if (item instanceof ListWaypointItem) {
                    let [result, removed] = newFile.replaceWaypoints(item.getWaypointIndex(), item.getWaypointIndex(), []);
                    newFile = castDraft(result);
                    context.push(...removed);
                }
            });
            context.reverse();
            return newFile;
        },
        (file, context: (Track | TrackSegment | Waypoint[] | Waypoint)[]) => {
            let newFile = file;
            toItems.forEach((item, i) => {
                if (item instanceof ListTrackItem && context[i] instanceof Track) {
                    let [result, _removed] = newFile.replaceTracks(item.getTrackIndex(), item.getTrackIndex() - 1, [context[i]]);
                    newFile = castDraft(result);
                } else if (item instanceof ListTrackSegmentItem && context[i] instanceof TrackSegment) {
                    let [result, _removed] = newFile.replaceTrackSegments(item.getTrackIndex(), item.getSegmentIndex(), item.getSegmentIndex() - 1, [context[i]]);
                    newFile = castDraft(result);
                } else if (item instanceof ListWaypointsItem && Array.isArray(context[i]) && context[i].length > 0 && context[i][0] instanceof Waypoint) {
                    let [result, _removed] = newFile.replaceWaypoints(0, -1, context[i]);
                    newFile = castDraft(result);
                } else if (item instanceof ListWaypointItem && context[i] instanceof Waypoint) {
                    let [result, _removed] = newFile.replaceWaypoints(item.getWaypointIndex(), item.getWaypointIndex() - 1, [context[i]]);
                    newFile = castDraft(result);
                }
            });
            return newFile;
        }
    ], []);
}
