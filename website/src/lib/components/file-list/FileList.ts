export class SelectionTreeType {
    item: ListItem;
    selected: boolean;
    children: {
        [key: string | number]: SelectionTreeType
    };

    constructor(item: ListItem) {
        this.item = item;
        this.selected = false;
        this.children = {};
    }

    clear() {
        this.selected = false;
        for (let key in this.children) {
            this.children[key].clear();
        }
    }

    _setOrToggle(item: ListItem, value?: boolean) {
        if (item.level === this.item.level) {
            this.selected = value === undefined ? !this.selected : value;
        } else {
            let id = item.getIdAtLevel(this.item.level);
            if (id !== undefined) {
                if (!this.children.hasOwnProperty(id)) {
                    this.children[id] = new SelectionTreeType(this.item.extend(id));
                }
                this.children[id]._setOrToggle(item, value);
            }
        }
    }

    set(item: ListItem, value: boolean) {
        this._setOrToggle(item, value);
    }

    toggle(item: ListItem) {
        this._setOrToggle(item);
    }

    has(item: ListItem): boolean {
        if (item.level === this.item.level) {
            return this.selected;
        } else {
            let id = item.getIdAtLevel(this.item.level);
            if (id !== undefined) {
                if (this.children.hasOwnProperty(id)) {
                    return this.children[id].has(item);
                }
            }
        }
        return false;
    }

    getSelected(selection?: ListItem[]): ListItem[] {
        if (selection === undefined) {
            selection = [];
        }
        if (this.selected) {
            selection.push(this.item);
        }
        for (let key in this.children) {
            this.children[key].getSelected(selection);
        }
        return selection;
    }

    forEach(callback: (item: ListItem) => void) {
        if (this.selected) {
            callback(this.item);
        }
        for (let key in this.children) {
            this.children[key].forEach(callback);
        }
    }

    getChild(id: string | number): SelectionTreeType | undefined {
        return this.children[id];
    }

    get size(): number {
        let size = this.selected ? 1 : 0;
        for (let key in this.children) {
            size += this.children[key].size;
        }
        return size;
    }
};

export type ListLevel = 'root' | 'file' | 'track' | 'segment' | 'waypoints' | 'waypoint';

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
        super('root');
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
        super('file');
        this.fileId = fileId;
    }

    getId(): string {
        return this.fileId;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case 'root':
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
        super('track');
        this.fileId = fileId;
        this.trackIndex = trackIndex;
    }

    getId(): number {
        return this.trackIndex;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case 'root':
                return this.fileId;
            case 'file':
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
        super('segment');
        this.fileId = fileId;
        this.trackIndex = trackIndex;
        this.segmentIndex = segmentIndex;
    }

    getId(): number {
        return this.segmentIndex;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case 'root':
                return this.fileId;
            case 'file':
                return this.trackIndex;
            case 'track':
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
        super('waypoints');
        this.fileId = fileId;
    }

    getId(): string {
        return 'waypoints';
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case 'root':
                return this.fileId;
            case 'file':
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
        super('waypoint');
        this.fileId = fileId;
        this.waypointIndex = waypointIndex;
    }

    getId(): number {
        return this.waypointIndex;
    }

    getIdAtLevel(level: ListLevel): string | number | undefined {
        switch (level) {
            case 'root':
                return this.fileId;
            case 'file':
                return 'waypoints';
            case 'waypoints':
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
