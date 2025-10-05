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
import { SelectionTreeType } from '$lib/logic/selection';
import { fileStateCollection } from '$lib/logic/file-state.svelte';
import { settings } from '$lib/logic/settings.svelte';
import type { GPXFile } from 'gpx';

export class Selection {
    private _selection: SelectionTreeType;
    private _copied: ListItem[] | undefined;
    private _cut: boolean;

    constructor() {
        this._selection = $state(new SelectionTreeType(new ListRootItem()));
        this._copied = $state(undefined);
        this._cut = $state(false);
    }

    get value(): SelectionTreeType {
        return this._selection;
    }

    selectItem(item: ListItem) {
        let selection = new SelectionTreeType(new ListRootItem());
        selection.set(item, true);
        this._selection = selection;
    }

    selectFile(fileId: string) {
        this.selectItem(new ListFileItem(fileId));
    }

    addSelectItem(item: ListItem) {
        this._selection.toggle(item);
    }

    addSelectFile(fileId: string) {
        this.addSelectItem(new ListFileItem(fileId));
    }

    selectAll() {
        let item: ListItem = new ListRootItem();
        this._selection.forEach((i) => {
            item = i;
        });
        let selection = new SelectionTreeType(new ListRootItem());
        if (item instanceof ListRootItem || item instanceof ListFileItem) {
            fileStateCollection.files.forEach((_file, fileId) => {
                selection.set(new ListFileItem(fileId), true);
            });
        } else if (item instanceof ListTrackItem) {
            let file = fileStateCollection.getFile(item.getFileId());
            if (file) {
                file.trk.forEach((_track, trackId) => {
                    selection.set(new ListTrackItem(item.getFileId(), trackId), true);
                });
            }
        } else if (item instanceof ListTrackSegmentItem) {
            let file = fileStateCollection.getFile(item.getFileId());
            if (file) {
                file.trk[item.getTrackIndex()].trkseg.forEach((_segment, segmentId) => {
                    selection.set(
                        new ListTrackSegmentItem(item.getFileId(), item.getTrackIndex(), segmentId),
                        true
                    );
                });
            }
        } else if (item instanceof ListWaypointItem) {
            let file = fileStateCollection.getFile(item.getFileId());
            if (file) {
                file.wpt.forEach((_waypoint, waypointId) => {
                    selection.set(new ListWaypointItem(item.getFileId(), waypointId), true);
                });
            }
        }
        this._selection = selection;
    }

    set(items: ListItem[]) {
        let selection = new SelectionTreeType(new ListRootItem());
        items.forEach((item) => {
            selection.set(item, true);
        });
        this._selection = selection;
    }

    update(updatedFiles: GPXFile[], deletedFileIds: string[]) {
        // TODO do it the other way around: get all selected items, and check if they still exist?
        // let removedItems: ListItem[] = [];
        // applyToOrderedItemsFromFile(selection.value.getSelected(), (fileId, level, items) => {
        //     let file = updatedFiles.find((file) => file._data.id === fileId);
        //     if (file) {
        //         items.forEach((item) => {
        //             if (item instanceof ListTrackItem) {
        //                 let newTrackIndex = file.trk.findIndex(
        //                     (track) => track._data.trackIndex === item.getTrackIndex()
        //                 );
        //                 if (newTrackIndex === -1) {
        //                     removedItems.push(item);
        //                 }
        //             } else if (item instanceof ListTrackSegmentItem) {
        //                 let newTrackIndex = file.trk.findIndex(
        //                     (track) => track._data.trackIndex === item.getTrackIndex()
        //                 );
        //                 if (newTrackIndex === -1) {
        //                     removedItems.push(item);
        //                 } else {
        //                     let newSegmentIndex = file.trk[newTrackIndex].trkseg.findIndex(
        //                         (segment) => segment._data.segmentIndex === item.getSegmentIndex()
        //                     );
        //                     if (newSegmentIndex === -1) {
        //                         removedItems.push(item);
        //                     }
        //                 }
        //             } else if (item instanceof ListWaypointItem) {
        //                 let newWaypointIndex = file.wpt.findIndex(
        //                     (wpt) => wpt._data.index === item.getWaypointIndex()
        //                 );
        //                 if (newWaypointIndex === -1) {
        //                     removedItems.push(item);
        //                 }
        //             }
        //         });
        //     } else if (deletedFileIds.includes(fileId)) {
        //         items.forEach((item) => {
        //             removedItems.push(item);
        //         });
        //     }
        // });
        // if (removedItems.length > 0) {
        //     selection.update(($selection) => {
        //         removedItems.forEach((item) => {
        //             if (item instanceof ListFileItem) {
        //                 $selection.deleteChild(item.getFileId());
        //             } else {
        //                 $selection.set(item, false);
        //             }
        //         });
        //         return $selection;
        //     });
        // }
    }

    getOrderedSelection(reverse: boolean = false): ListItem[] {
        let selected: ListItem[] = [];
        applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            selected.push(...items);
        }, reverse);
        return selected;
    }

    copySelection(): boolean {
        let selected = this._selection.getSelected();
        if (selected.length > 0) {
            this._copied = selected;
            this._cut = false;
            return true;
        }
        return false;
    }

    cutSelection() {
        if (this.copySelection()) {
            this._cut = true;
        }
    }

    resetCopied() {
        this._copied = undefined;
        this._cut = false;
    }

    get copied(): ListItem[] | undefined {
        return this._copied;
    }

    get cut(): boolean {
        return this._cut;
    }
}

export const selection = new Selection();

export function applyToOrderedItemsFromFile(
    selectedItems: ListItem[],
    callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void,
    reverse: boolean = true
) {
    settings.fileOrder.value.forEach((fileId) => {
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

export function applyToOrderedSelectedItemsFromFile(
    callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void,
    reverse: boolean = true
) {
    applyToOrderedItemsFromFile(selection.value.getSelected(), callback, reverse);
}
