import { isMac } from '$lib/utils';
import Sortable, { type Direction } from 'sortablejs/Sortable';
import { ListLevel } from './file-list';
import { get, writable } from 'svelte/store';
import { tick } from 'svelte';
import { engine } from '$lib/engine';
import { isSelected, type FileTreeNode } from '$lib/selection-helpers';
// TODO moving elements between parents is not available in the engine yet
// import { ListItem, ListRootItem } from './file-list';
// import { getFileIds, moveItems } from '$lib/logic/file-actions';
// import { settings } from '$lib/logic/settings';
// const { fileOrder } = settings;

export const allowedMoves: Record<ListLevel, ListLevel[]> = {
    [ListLevel.ROOT]: [],
    [ListLevel.FILE]: [ListLevel.FILE],
    [ListLevel.TRACK]: [ListLevel.FILE, ListLevel.TRACK],
    [ListLevel.SEGMENT]: [ListLevel.FILE, ListLevel.TRACK, ListLevel.SEGMENT],
    [ListLevel.WAYPOINTS]: [ListLevel.WAYPOINTS],
    [ListLevel.WAYPOINT]: [ListLevel.WAYPOINTS, ListLevel.WAYPOINT],
};

export const dragging = writable<ListLevel | null>(null);

/**
 * Makes a list of the file tree sortable and selectable. The elements of the list are the
 * children of `parent` (the files when `parent` is null), their ids are in their `data-id`.
 */
export class SortableFileList {
    private _parent: FileTreeNode | null;
    private _sortableLevel: ListLevel;
    private _container: HTMLElement;
    private _sortable: Sortable | null = null;
    private _elements: { [id: string]: HTMLElement } = {};
    private _updatingSelection: boolean = false;
    private _unsubscribes: (() => void)[] = [];

    constructor(
        container: HTMLElement,
        parent: FileTreeNode | null,
        waypointRoot: boolean,
        sortableLevel: ListLevel,
        orientation: Direction
    ) {
        this._parent = parent;
        this._sortableLevel = sortableLevel;
        this._container = container;
        // TODO only the order of the files can be changed for now: the other lists neither sort
        // nor exchange elements (allowedMoves, to be used again once the engine can move elements)
        const sortable = sortableLevel === ListLevel.FILE;
        this._sortable = Sortable.create(container, {
            group: {
                name: sortableLevel,
                pull: sortable ? allowedMoves[sortableLevel] : false,
                put: sortable ? [ListLevel.FILE] : false,
            },
            sort: sortable,
            direction: orientation,
            forceAutoScrollFallback: true,
            multiDrag: true,
            multiDragKey: isMac() ? 'Meta' : 'Ctrl',
            avoidImplicitDeselect: true,
            onSelect: (e: Sortable.SortableEvent) =>
                setTimeout(() => this.updateToSelection(e), 50),
            onDeselect: (e: Sortable.SortableEvent) =>
                setTimeout(() => this.updateToSelection(e), 50),
            onStart: () => dragging.set(sortableLevel),
            onEnd: () => dragging.set(null),
            onSort: (e: Sortable.SortableEvent) => this.onSort(e),
        });
        Object.defineProperty(this._sortable, '_waypointRoot', {
            value: waypointRoot,
            writable: true,
        });

        this._unsubscribes.push(
            engine.selection.subscribe(() => tick().then(() => this.updateFromSelection()))
        );
        // after the elements are rendered: sorting a list that does not have the new files yet
        // would put them at the beginning
        this._unsubscribes.push(
            engine.order.subscribe(() => tick().then(() => this.updateFromFileOrder()))
        );
    }

    /** The node of a child of the list. */
    childNode(id: string): FileTreeNode | undefined {
        const parent = this._parent;
        switch (this._sortableLevel) {
            case ListLevel.FILE:
                return { type: 'file', fileId: id };
            case ListLevel.TRACK:
                return parent ? { type: 'track', fileId: parent.fileId, trackId: id } : undefined;
            case ListLevel.SEGMENT:
                return parent?.type === 'track'
                    ? {
                          type: 'segment',
                          fileId: parent.fileId,
                          trackId: parent.trackId,
                          segmentId: id,
                      }
                    : undefined;
            case ListLevel.WAYPOINTS:
                return parent ? { type: 'waypoints', fileId: parent.fileId } : undefined;
            case ListLevel.WAYPOINT:
                return parent
                    ? { type: 'waypoint', fileId: parent.fileId, waypointId: id }
                    : undefined;
        }
    }

    onSort(e: Sortable.SortableEvent) {
        this.updateToFileOrder();

        // TODO moving elements between parents: the engine has no command for it yet, the code
        // below worked on the previous implementation
        // onSort(e: Sortable.SortableEvent) {
        //     this.updateToFileOrder();

        //     const from = Sortable.get(e.from);
        //     const to = Sortable.get(e.to);

        //     if (!from || !to) {
        //         return;
        //     }

        //     let fromItem = from._item;
        //     let toItem = to._item;

        //     if (this._item === toItem && !(fromItem instanceof ListRootItem)) {
        //         // Event is triggered on source and destination list, only handle it once
        //         let fromItems = [];
        //         let toItems = [];

        //         if (from._waypointRoot) {
        //             fromItems = [fromItem.extend('waypoints')];
        //         } else {
        //             let oldIndices: number[] =
        //                 e.oldIndicies.length > 0 ? e.oldIndicies.map((i) => i.index) : [e.oldIndex];
        //             oldIndices = oldIndices.filter((i) => i >= 0);
        //             oldIndices.sort((a, b) => a - b);

        //             fromItems = oldIndices.map((i) => fromItem.extend(i));
        //         }

        //         if (from._waypointRoot && to._waypointRoot) {
        //             toItems = [toItem.extend('waypoints')];
        //         } else {
        //             if (to._waypointRoot) {
        //                 toItem = toItem.extend('waypoints');
        //             }

        //             let newIndices: number[] =
        //                 e.newIndicies.length > 0 ? e.newIndicies.map((i) => i.index) : [e.newIndex];
        //             newIndices = newIndices.filter((i) => i >= 0);
        //             newIndices.sort((a, b) => a - b);

        //             if (toItem instanceof ListRootItem) {
        //                 let newFileIds = getFileIds(newIndices.length);
        //                 toItems = newIndices.map((i, index) => {
        //                     get(fileOrder).splice(i, 0, newFileIds[index]);
        //                     return this._item.extend(newFileIds[index]);
        //                 });
        //             } else {
        //                 toItems = newIndices.map((i) => toItem.extend(i));
        //             }
        //         }

        //         moveItems(fromItem, toItem, fromItems, toItems);
        //     }
        // }
    }

    updateFromSelection() {
        const changed = this.getChangedIds();
        if (changed.length === 0) {
            return;
        }
        const selection_ = get(engine.selection);
        for (let id of changed) {
            let element = this._elements[id];
            let node = this.childNode(id);
            if (element && node) {
                if (isSelected(selection_, node)) {
                    Sortable.utils.select(element);
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                    });
                } else {
                    Sortable.utils.deselect(element);
                }
            }
        }
    }

    updateToSelection(e: Sortable.SortableEvent) {
        if (!this._sortable) return;
        if (this._updatingSelection) return;
        this._updatingSelection = true;
        const changed = this.getChangedIds();
        if (changed.length == 0) {
            this._updatingSelection = false;
            return;
        }

        let selected = Object.entries(this._elements)
            .filter(([, element]) => element.classList.contains('sortable-selected'))
            .map(([id]) => id);

        if (
            e.originalEvent &&
            !(e.originalEvent.ctrlKey || e.originalEvent.metaKey || e.originalEvent.shiftKey) &&
            (selected.length > 1 || !selected.includes(changed[0]))
        ) {
            // Fix bug that sometimes causes a single select to be treated as a multi-select
            selected = [changed[0]];
        }

        const parent = this._parent;
        if (selected.length === 0 || !this.childNode(selected[0])) {
            engine.select([]);
        } else {
            switch (this._sortableLevel) {
                case ListLevel.FILE:
                    engine.select(selected);
                    break;
                case ListLevel.TRACK:
                    engine.selectTracks(parent!.fileId, selected);
                    break;
                case ListLevel.SEGMENT:
                    engine.selectSegments(parent!.fileId, (parent as any).trackId, selected);
                    break;
                case ListLevel.WAYPOINTS:
                    engine.selectWaypointGroup(parent!.fileId);
                    break;
                case ListLevel.WAYPOINT:
                    engine.selectWaypoints(parent!.fileId, selected);
                    break;
            }
        }
        this._updatingSelection = false;
    }

    updateFromFileOrder() {
        if (!this._sortable || this._sortableLevel !== ListLevel.FILE) {
            return;
        }

        const fileOrder_ = get(engine.order);
        const sortableOrder = this._sortable.toArray();

        if (
            fileOrder_.length !== sortableOrder.length ||
            fileOrder_.some((value, index) => value !== sortableOrder[index])
        ) {
            this._sortable.sort(fileOrder_);
        }
    }

    updateToFileOrder() {
        if (!this._sortable || this._sortableLevel !== ListLevel.FILE) {
            return;
        }

        const fileOrder_ = get(engine.order);
        const sortableOrder = this._sortable.toArray();

        if (
            fileOrder_.length !== sortableOrder.length ||
            fileOrder_.some((value, index) => value !== sortableOrder[index])
        ) {
            engine.reorder(sortableOrder, 0);
        }
    }

    updateElements() {
        this._elements = {};
        const files = get(engine.files);
        this._container.childNodes.forEach((element) => {
            if (element instanceof HTMLElement) {
                let attr = element.getAttribute('data-id');
                if (attr) {
                    if (this._sortableLevel === ListLevel.FILE && !files.has(attr)) {
                        element.remove();
                    } else {
                        this._elements[attr] = element;
                    }
                }
            }
        });
    }

    destroy() {
        this._sortable = null;
        this._unsubscribes.forEach((unsubscribe) => unsubscribe());
        this._unsubscribes = [];
    }

    getChangedIds() {
        let changed: string[] = [];
        const selection_ = get(engine.selection);
        Object.entries(this._elements).forEach(([id, element]) => {
            const node = this.childNode(id);
            let inSelection = node !== undefined && isSelected(selection_, node);
            let isSelectedInList = element.classList.contains('sortable-selected');
            if (inSelection !== isSelectedInList) {
                changed.push(id);
            }
        });
        return changed;
    }
}
