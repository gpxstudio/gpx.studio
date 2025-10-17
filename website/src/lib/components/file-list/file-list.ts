export enum ListLevel {
    ROOT,
    FILE,
    TRACK,
    SEGMENT,
    WAYPOINTS,
    WAYPOINT,
}

export const allowedMoves: Record<ListLevel, ListLevel[]> = {
    [ListLevel.ROOT]: [],
    [ListLevel.FILE]: [ListLevel.FILE],
    [ListLevel.TRACK]: [ListLevel.FILE, ListLevel.TRACK],
    [ListLevel.SEGMENT]: [ListLevel.FILE, ListLevel.TRACK, ListLevel.SEGMENT],
    [ListLevel.WAYPOINTS]: [ListLevel.WAYPOINTS],
    [ListLevel.WAYPOINT]: [ListLevel.WAYPOINTS, ListLevel.WAYPOINT],
};

export const allowedPastes: Record<ListLevel, ListLevel[]> = {
    [ListLevel.ROOT]: [],
    [ListLevel.FILE]: [ListLevel.ROOT, ListLevel.FILE],
    [ListLevel.TRACK]: [ListLevel.ROOT, ListLevel.FILE, ListLevel.TRACK],
    [ListLevel.SEGMENT]: [ListLevel.ROOT, ListLevel.FILE, ListLevel.TRACK, ListLevel.SEGMENT],
    [ListLevel.WAYPOINTS]: [ListLevel.FILE, ListLevel.WAYPOINTS, ListLevel.WAYPOINT],
    [ListLevel.WAYPOINT]: [ListLevel.FILE, ListLevel.WAYPOINTS, ListLevel.WAYPOINT],
};

export abstract class ListItem {
    [x: string]: any;
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
