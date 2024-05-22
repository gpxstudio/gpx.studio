import { get, writable } from "svelte/store";
import { ListFileItem, ListRootItem, SelectionTreeType } from "./FileList";
import { fileObservers } from "$lib/db";

export const selection = writable<SelectionTreeType>(new SelectionTreeType(new ListRootItem()));

export function selectAll() {
    selection.update(($selection) => {
        get(fileObservers).forEach((_file, fileId) => {
            $selection.set(new ListFileItem(fileId), true);
        });
        return $selection;
    });
}