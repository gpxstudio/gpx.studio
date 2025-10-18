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
} from '$lib/components/file-list/file-list';
import { fileStateCollection, GPXFileStateCollectionObserver } from '$lib/logic/file-state';
import { settings } from '$lib/logic/settings';
import type { GPXFile } from 'gpx';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { SelectionTreeType } from '$lib/logic/selection-tree';

export class Selection {
    private _selection: Writable<SelectionTreeType>;
    private _copied: Writable<ListItem[] | undefined>;
    private _cut: Writable<boolean>;

    constructor() {
        this._selection = writable(new SelectionTreeType(new ListRootItem()));
        this._copied = writable(undefined);
        this._cut = writable(false);
    }

    subscribe(
        run: (value: SelectionTreeType) => void,
        invalidate?: (value?: SelectionTreeType) => void
    ) {
        return this._selection.subscribe(run, invalidate);
    }

    selectItem(item: ListItem) {
        this._selection.update(($selection) => {
            $selection.clear();
            $selection.set(item, true);
            return $selection;
        });
    }

    selectFile(fileId: string) {
        this.selectItem(new ListFileItem(fileId));
    }

    addSelectItem(item: ListItem) {
        this._selection.update(($selection) => {
            $selection.toggle(item);
            return $selection;
        });
    }

    addSelectFile(fileId: string) {
        this.addSelectItem(new ListFileItem(fileId));
    }

    selectAll() {
        let item: ListItem = new ListRootItem();
        get(this._selection).forEach((i) => {
            item = i;
        });
        this._selection.update(($selection) => {
            $selection.clear();
            if (item instanceof ListRootItem || item instanceof ListFileItem) {
                fileStateCollection.forEach((fileId, file) => {
                    $selection.set(new ListFileItem(fileId), true);
                });
            } else if (item instanceof ListTrackItem) {
                let file = fileStateCollection.getFile(item.getFileId());
                if (file) {
                    file.trk.forEach((_track, trackId) => {
                        $selection.set(new ListTrackItem(item.getFileId(), trackId), true);
                    });
                }
            } else if (item instanceof ListTrackSegmentItem) {
                let file = fileStateCollection.getFile(item.getFileId());
                if (file) {
                    file.trk[item.getTrackIndex()].trkseg.forEach((_segment, segmentId) => {
                        $selection.set(
                            new ListTrackSegmentItem(
                                item.getFileId(),
                                item.getTrackIndex(),
                                segmentId
                            ),
                            true
                        );
                    });
                }
            } else if (item instanceof ListWaypointItem) {
                let file = fileStateCollection.getFile(item.getFileId());
                if (file) {
                    file.wpt.forEach((_waypoint, waypointId) => {
                        $selection.set(new ListWaypointItem(item.getFileId(), waypointId), true);
                    });
                }
            }
            return $selection;
        });
    }

    set(items: ListItem[]) {
        this._selection.update(($selection) => {
            $selection.clear();
            items.forEach((item) => {
                $selection.set(item, true);
            });
            return $selection;
        });
    }

    update(updatedFiles: GPXFile[], deletedFileIds: string[]) {
        let removedItems: ListItem[] = [];
        applyToOrderedItemsFromFile(get(this._selection).getSelected(), (fileId, level, items) => {
            let file = updatedFiles.find((file) => file._data.id === fileId);
            if (file) {
                items.forEach((item) => {
                    if (item instanceof ListTrackItem) {
                        let newTrackIndex = file.trk.findIndex(
                            (track) => track._data.trackIndex === item.getTrackIndex()
                        );
                        if (newTrackIndex === -1) {
                            removedItems.push(item);
                        }
                    } else if (item instanceof ListTrackSegmentItem) {
                        let newTrackIndex = file.trk.findIndex(
                            (track) => track._data.trackIndex === item.getTrackIndex()
                        );
                        if (newTrackIndex === -1) {
                            removedItems.push(item);
                        } else {
                            let newSegmentIndex = file.trk[newTrackIndex].trkseg.findIndex(
                                (segment) => segment._data.segmentIndex === item.getSegmentIndex()
                            );
                            if (newSegmentIndex === -1) {
                                removedItems.push(item);
                            }
                        }
                    } else if (item instanceof ListWaypointItem) {
                        let newWaypointIndex = file.wpt.findIndex(
                            (wpt) => wpt._data.index === item.getWaypointIndex()
                        );
                        if (newWaypointIndex === -1) {
                            removedItems.push(item);
                        }
                    }
                });
            } else if (deletedFileIds.includes(fileId)) {
                items.forEach((item) => {
                    removedItems.push(item);
                });
            }
        });
        if (removedItems.length > 0) {
            this._selection.update(($selection) => {
                removedItems.forEach((item) => {
                    if (item instanceof ListFileItem) {
                        $selection.deleteChild(item.getFileId());
                    } else {
                        $selection.set(item, false);
                    }
                });
                return $selection;
            });
        }
    }

    getOrderedSelection(reverse: boolean = false): ListItem[] {
        let selected: ListItem[] = [];
        this.applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            selected.push(...items);
        }, reverse);
        return selected;
    }

    applyToOrderedSelectedItemsFromFile(
        callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void,
        reverse: boolean = true
    ) {
        applyToOrderedItemsFromFile(get(this._selection).getSelected(), callback, reverse);
    }

    copySelection(): boolean {
        let selected = get(this._selection).getSelected();
        if (selected.length > 0) {
            this._copied.set(selected);
            this._cut.set(false);
            return true;
        }
        return false;
    }

    cutSelection() {
        if (this.copySelection()) {
            this._cut.set(true);
        }
    }

    resetCopied() {
        this._copied.set(undefined);
        this._cut.set(false);
    }

    get copied(): Readable<ListItem[] | undefined> {
        return this._copied;
    }

    get cut(): Readable<boolean> {
        return this._cut;
    }
}

export const selection = new Selection();
export const copied = selection.copied;
export const cut = selection.cut;

export function applyToOrderedItemsFromFile(
    selectedItems: ListItem[],
    callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void,
    reverse: boolean = true
) {
    get(settings.fileOrder).forEach((fileId) => {
        let level: ListLevel | undefined = undefined;
        let items: ListItem[] = [];
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
