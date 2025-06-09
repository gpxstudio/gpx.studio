import { get, writable } from 'svelte/store';
import {
    ListFileItem,
    ListItem,
    ListRootItem,
    ListTrackItem,
    ListTrackSegmentItem,
    ListWaypointItem,
    ListLevel,
    sortItems,
    ListWaypointsItem,
    moveItems,
} from './FileList';
import { fileObservers, getFile, getFileIds, settings } from '$lib/db';

export class SelectionTreeType {
    item: ListItem;
    selected: boolean;
    children: {
        [key: string | number]: SelectionTreeType;
    };
    size: number = 0;

    constructor(item: ListItem) {
        this.item = item;
        this.selected = false;
        this.children = {};
    }

    clear() {
        this.selected = false;
        for (const key in this.children) {
            this.children[key].clear();
        }
        this.size = 0;
    }

    _setOrToggle(item: ListItem, value?: boolean) {
        if (item.level === this.item.level) {
            const newSelected = value === undefined ? !this.selected : value;
            if (this.selected !== newSelected) {
                this.selected = newSelected;
                this.size += this.selected ? 1 : -1;
            }
        } else {
            const id = item.getIdAtLevel(this.item.level);
            if (id !== undefined) {
                if (!Object.hasOwn(this.children, id)) {
                    this.children[id] = new SelectionTreeType(this.item.extend(id));
                }
                this.size -= this.children[id].size;
                this.children[id]._setOrToggle(item, value);
                this.size += this.children[id].size;
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
            const id = item.getIdAtLevel(this.item.level);
            if (id !== undefined) {
                if (Object.hasOwn(this.children, id)) {
                    return this.children[id].has(item);
                }
            }
        }
        return false;
    }

    hasAnyParent(item: ListItem, self: boolean = true): boolean {
        if (
            this.selected &&
            this.item.level <= item.level &&
            (self || this.item.level < item.level)
        ) {
            return this.selected;
        }
        const id = item.getIdAtLevel(this.item.level);
        if (id !== undefined) {
            if (Object.hasOwn(this.children, id)) {
                return this.children[id].hasAnyParent(item, self);
            }
        }
        return false;
    }

    hasAnyChildren(item: ListItem, self: boolean = true, ignoreIds?: (string | number)[]): boolean {
        if (
            this.selected &&
            this.item.level >= item.level &&
            (self || this.item.level > item.level)
        ) {
            return this.selected;
        }
        const id = item.getIdAtLevel(this.item.level);
        if (id !== undefined) {
            if (ignoreIds === undefined || ignoreIds.indexOf(id) === -1) {
                if (Object.hasOwn(this.children, id)) {
                    return this.children[id].hasAnyChildren(item, self, ignoreIds);
                }
            }
        } else {
            for (const key in this.children) {
                if (
                    Object.hasOwn(this.children, key) &&
                    (ignoreIds === undefined || ignoreIds.indexOf(key) === -1)
                ) {
                    if (this.children[key].hasAnyChildren(item, self, ignoreIds)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getSelected(selection: ListItem[] = []): ListItem[] {
        if (this.selected) {
            selection.push(this.item);
        }
        for (const key in this.children) {
            this.children[key].getSelected(selection);
        }
        return selection;
    }

    forEach(callback: (item: ListItem) => void) {
        if (this.selected) {
            callback(this.item);
        }
        for (const key in this.children) {
            this.children[key].forEach(callback);
        }
    }

    getChild(id: string | number): SelectionTreeType | undefined {
        return this.children[id];
    }

    deleteChild(id: string | number) {
        if (Object.hasOwn(this.children, id)) {
            this.size -= this.children[id].size;
            delete this.children[id];
        }
    }
}

export const selection = writable<SelectionTreeType>(new SelectionTreeType(new ListRootItem()));

export function selectItem(item: ListItem) {
    selection.update(($selection) => {
        $selection.clear();
        $selection.set(item, true);
        return $selection;
    });
}

export function selectFile(fileId: string) {
    selectItem(new ListFileItem(fileId));
}

export function addSelectItem(item: ListItem) {
    selection.update(($selection) => {
        $selection.toggle(item);
        return $selection;
    });
}

export function addSelectFile(fileId: string) {
    addSelectItem(new ListFileItem(fileId));
}

export function selectAll() {
    selection.update(($selection) => {
        let item: ListItem = new ListRootItem();
        $selection.forEach((i) => {
            item = i;
        });

        if (item instanceof ListRootItem || item instanceof ListFileItem) {
            $selection.clear();
            get(fileObservers).forEach((_file, fileId) => {
                $selection.set(new ListFileItem(fileId), true);
            });
        } else if (item instanceof ListTrackItem) {
            const file = getFile(item.getFileId());
            if (file) {
                file.trk.forEach((_track, trackId) => {
                    $selection.set(new ListTrackItem(item.getFileId(), trackId), true);
                });
            }
        } else if (item instanceof ListTrackSegmentItem) {
            const file = getFile(item.getFileId());
            if (file) {
                file.trk[item.getTrackIndex()].trkseg.forEach((_segment, segmentId) => {
                    $selection.set(
                        new ListTrackSegmentItem(item.getFileId(), item.getTrackIndex(), segmentId),
                        true
                    );
                });
            }
        } else if (item instanceof ListWaypointItem) {
            const file = getFile(item.getFileId());
            if (file) {
                file.wpt.forEach((_waypoint, waypointId) => {
                    $selection.set(new ListWaypointItem(item.getFileId(), waypointId), true);
                });
            }
        }

        return $selection;
    });
}

export function getOrderedSelection(reverse: boolean = false): ListItem[] {
    const selected: ListItem[] = [];
    applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
        selected.push(...items);
    }, reverse);
    return selected;
}

export function applyToOrderedItemsFromFile(
    selectedItems: ListItem[],
    callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void,
    reverse: boolean = true
) {
    get(settings.fileOrder).forEach((fileId) => {
        let level: ListLevel | undefined = undefined;
        const items: ListItem[] = [];
        selectedItems.forEach((item) => {
            if (item.getFileId() === fileId) {
                level = item.level;
                if (
                    item instanceof ListFileItem ||
                    item instanceof ListTrackItem ||
                    item instanceof ListTrackSegmentItem ||
                    item instanceof ListWaypointsItem ||
                    item instanceof ListWaypointItem
                ) {
                    items.push(item);
                }
            }
        });

        if (items.length > 0) {
            sortItems(items, reverse);
            callback(fileId, level, items);
        }
    });
}

export function applyToOrderedSelectedItemsFromFile(
    callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void,
    reverse: boolean = true
) {
    applyToOrderedItemsFromFile(get(selection).getSelected(), callback, reverse);
}

export const copied = writable<ListItem[] | undefined>(undefined);
export const cut = writable(false);

export function copySelection(): boolean {
    const selected = get(selection).getSelected();
    if (selected.length > 0) {
        copied.set(selected);
        cut.set(false);
        return true;
    }
    return false;
}

export function cutSelection() {
    if (copySelection()) {
        cut.set(true);
    }
}

function resetCopied() {
    copied.set(undefined);
    cut.set(false);
}

export function pasteSelection() {
    const fromItems = get(copied);
    if (fromItems === undefined || fromItems.length === 0) {
        return;
    }

    let selected = get(selection).getSelected();
    if (selected.length === 0) {
        selected = [new ListRootItem()];
    }

    const fromParent = fromItems[0].getParent();
    let toParent = selected[selected.length - 1];

    let startIndex: number | undefined = undefined;

    if (fromItems[0].level === toParent.level) {
        if (
            toParent instanceof ListTrackItem ||
            toParent instanceof ListTrackSegmentItem ||
            toParent instanceof ListWaypointItem
        ) {
            startIndex = toParent.getId() + 1;
        }
        toParent = toParent.getParent();
    }

    const toItems: ListItem[] = [];
    if (toParent.level === ListLevel.ROOT) {
        const fileIds = getFileIds(fromItems.length);
        fileIds.forEach((fileId) => {
            toItems.push(new ListFileItem(fileId));
        });
    } else {
        const toFile = getFile(toParent.getFileId());
        if (toFile) {
            fromItems.forEach((item, index) => {
                if (toParent instanceof ListFileItem) {
                    if (item instanceof ListTrackItem || item instanceof ListTrackSegmentItem) {
                        toItems.push(
                            new ListTrackItem(
                                toParent.getFileId(),
                                (startIndex ?? toFile.trk.length) + index
                            )
                        );
                    } else if (item instanceof ListWaypointsItem) {
                        toItems.push(new ListWaypointsItem(toParent.getFileId()));
                    } else if (item instanceof ListWaypointItem) {
                        toItems.push(
                            new ListWaypointItem(
                                toParent.getFileId(),
                                (startIndex ?? toFile.wpt.length) + index
                            )
                        );
                    }
                } else if (toParent instanceof ListTrackItem) {
                    if (item instanceof ListTrackSegmentItem) {
                        const toTrackIndex = toParent.getTrackIndex();
                        toItems.push(
                            new ListTrackSegmentItem(
                                toParent.getFileId(),
                                toTrackIndex,
                                (startIndex ?? toFile.trk[toTrackIndex].trkseg.length) + index
                            )
                        );
                    }
                } else if (toParent instanceof ListWaypointsItem) {
                    if (item instanceof ListWaypointItem) {
                        toItems.push(
                            new ListWaypointItem(
                                toParent.getFileId(),
                                (startIndex ?? toFile.wpt.length) + index
                            )
                        );
                    }
                }
            });
        }
    }

    if (fromItems.length === toItems.length) {
        moveItems(fromParent, toParent, fromItems, toItems, get(cut));
        resetCopied();
    }
}
