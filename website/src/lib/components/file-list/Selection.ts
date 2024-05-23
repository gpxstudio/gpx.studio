import { get, writable } from "svelte/store";
import { ListFileItem, ListItem, ListRootItem, SelectionTreeType } from "./FileList";
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
        get(fileObservers).forEach((_file, fileId) => {
            $selection.set(new ListFileItem(fileId), true);
        });
        return $selection;
    });
}