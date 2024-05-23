import { get, writable } from "svelte/store";
import { ListFileItem, ListItem, ListRootItem, ListTrackItem, ListTrackSegmentItem, ListWaypointItem, SelectionTreeType } from "./FileList";
import { fileObservers } from "$lib/db";

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

export function addSelect(fileId: string) {
    selection.update(($selection) => {
        $selection.toggle(new ListFileItem(fileId));
        return $selection;
    });
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