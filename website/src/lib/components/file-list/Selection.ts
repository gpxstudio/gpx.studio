import { get, writable } from "svelte/store";
import { ListFileItem, ListItem, ListRootItem, ListTrackItem, ListTrackSegmentItem, ListWaypointItem, SelectionTreeType, type ListLevel } from "./FileList";
import { fileObservers, settings } from "$lib/db";

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
            let fileStore = get(fileObservers).get(item.getFileId());
            if (fileStore) {
                get(fileStore)?.file.trk.forEach((_track, trackId) => {
                    $selection.set(new ListTrackItem(item.getFileId(), trackId), true);
                });
            }
        } else if (item instanceof ListTrackSegmentItem) {
            let fileStore = get(fileObservers).get(item.getFileId());
            if (fileStore) {
                get(fileStore)?.file.trk[item.getTrackIndex()].trkseg.forEach((_segment, segmentId) => {
                    $selection.set(new ListTrackSegmentItem(item.getFileId(), item.getTrackIndex(), segmentId), true);
                });
            }
        } else if (item instanceof ListWaypointItem) {
            let fileStore = get(fileObservers).get(item.getFileId());
            if (fileStore) {
                get(fileStore)?.file.wpt.forEach((_waypoint, waypointId) => {
                    $selection.set(new ListWaypointItem(item.getFileId(), waypointId), true);
                });
            }
        }

        return $selection;
    });
}

export function applyToOrderedSelectedItemsFromFile(callback: (fileId: string, level: ListLevel | undefined, items: ListItem[]) => void, reverse: boolean = true) {
    get(settings.fileOrder).forEach((fileId) => {
        let level: ListLevel | undefined = undefined;
        let items: ListItem[] = [];
        get(selection).forEach((item) => {
            if (item.getFileId() === fileId) {
                level = item.level;
                if (item instanceof ListFileItem || item instanceof ListTrackItem || item instanceof ListTrackSegmentItem || item instanceof ListWaypointItem) {
                    items.push(item);
                }
            }
        });

        if (items.length > 0) {
            if (reverse) {
                items.sort((a, b) => { // Process the items in reverse order to avoid index conflicts
                    if (a instanceof ListTrackItem && b instanceof ListTrackItem) {
                        return b.getTrackIndex() - a.getTrackIndex();
                    } else if (a instanceof ListTrackSegmentItem && b instanceof ListTrackSegmentItem) {
                        return b.getSegmentIndex() - a.getSegmentIndex();
                    } else if (a instanceof ListWaypointItem && b instanceof ListWaypointItem) {
                        return b.getWaypointIndex() - a.getWaypointIndex();
                    }
                    return b.level - a.level;
                });
            }

            callback(fileId, level, items);
        }
    });
}