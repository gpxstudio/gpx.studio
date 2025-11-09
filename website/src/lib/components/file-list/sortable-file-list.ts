import { isMac } from '$lib/utils';
import Sortable, { type Direction } from 'sortablejs/Sortable';
import { ListItem, ListLevel, ListRootItem } from './file-list';
import { selection } from '$lib/logic/selection';
import { getFileIds, moveItems } from '$lib/logic/file-actions';
import { get, writable, type Readable } from 'svelte/store';
import { settings } from '$lib/logic/settings';
import type { GPXFileWithStatistics } from '$lib/logic/statistics-tree';
import type { AnyGPXTreeElement, GPXTreeElement, Waypoint } from 'gpx';
import { tick } from 'svelte';

const { fileOrder } = settings;

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

export const dragging = writable<ListLevel | null>(null);

export class SortableFileList {
    private _node:
        | Map<string, Readable<GPXFileWithStatistics | undefined>>
        | GPXTreeElement<AnyGPXTreeElement>
        | Waypoint[]
        | Waypoint;
    private _item: ListItem;
    private _sortableLevel: ListLevel;
    private _container: HTMLElement;
    private _sortable: Sortable | null = null;
    private _elements: { [id: string]: HTMLElement } = {};
    private _updatingSelection: boolean = false;
    private _unsubscribes: (() => void)[] = [];

    constructor(
        container: HTMLElement,
        node:
            | Map<string, Readable<GPXFileWithStatistics | undefined>>
            | GPXTreeElement<AnyGPXTreeElement>
            | Waypoint[]
            | Waypoint,
        item: ListItem,
        waypointRoot: boolean,
        sortableLevel: ListLevel,
        orientation: Direction
    ) {
        this._node = node;
        this._item = item;
        this._sortableLevel = sortableLevel;
        this._container = container;
        this._sortable = Sortable.create(container, {
            group: {
                name: sortableLevel,
                pull: allowedMoves[sortableLevel],
                put: true,
            },
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
        Object.defineProperty(this._sortable, '_item', {
            value: item,
            writable: true,
        });

        Object.defineProperty(this._sortable, '_waypointRoot', {
            value: waypointRoot,
            writable: true,
        });

        this._unsubscribes.push(
            selection.subscribe(() => tick().then(() => this.updateFromSelection()))
        );
        this._unsubscribes.push(fileOrder.subscribe(() => this.updateFromFileOrder()));
    }

    onSort(e: Sortable.SortableEvent) {
        this.updateToFileOrder();

        const from = Sortable.get(e.from);
        const to = Sortable.get(e.to);

        if (!from || !to) {
            return;
        }

        let fromItem = from._item;
        let toItem = to._item;

        if (this._item === toItem && !(fromItem instanceof ListRootItem)) {
            // Event is triggered on source and destination list, only handle it once
            let fromItems = [];
            let toItems = [];

            if (from._waypointRoot) {
                fromItems = [fromItem.extend('waypoints')];
            } else {
                let oldIndices: number[] =
                    e.oldIndicies.length > 0 ? e.oldIndicies.map((i) => i.index) : [e.oldIndex];
                oldIndices = oldIndices.filter((i) => i >= 0);
                oldIndices.sort((a, b) => a - b);

                fromItems = oldIndices.map((i) => fromItem.extend(i));
            }

            if (from._waypointRoot && to._waypointRoot) {
                toItems = [toItem.extend('waypoints')];
            } else {
                if (to._waypointRoot) {
                    toItem = toItem.extend('waypoints');
                }

                let newIndices: number[] =
                    e.newIndicies.length > 0 ? e.newIndicies.map((i) => i.index) : [e.newIndex];
                newIndices = newIndices.filter((i) => i >= 0);
                newIndices.sort((a, b) => a - b);

                if (toItem instanceof ListRootItem) {
                    let newFileIds = getFileIds(newIndices.length);
                    toItems = newIndices.map((i, index) => {
                        get(fileOrder).splice(i, 0, newFileIds[index]);
                        return this._item.extend(newFileIds[index]);
                    });
                } else {
                    toItems = newIndices.map((i) => toItem.extend(i));
                }
            }

            moveItems(fromItem, toItem, fromItems, toItems);
        }
    }

    updateFromSelection() {
        const changed = this.getChangedIds();
        if (changed.length === 0) {
            return;
        }
        const selection_ = get(selection);
        for (let id of changed) {
            let element = this._elements[id];
            if (element) {
                if (selection_.has(this._item.extend(id))) {
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
        selection.update(($selection) => {
            $selection.clear();
            Object.entries(this._elements).forEach(([id, element]) => {
                $selection.set(
                    this._item.extend(this.getRealId(id)),
                    element.classList.contains('sortable-selected')
                );
            });

            if (
                e.originalEvent &&
                !(e.originalEvent.ctrlKey || e.originalEvent.metaKey || e.originalEvent.shiftKey) &&
                ($selection.size > 1 ||
                    !$selection.has(this._item.extend(this.getRealId(changed[0]))))
            ) {
                // Fix bug that sometimes causes a single select to be treated as a multi-select
                $selection.clear();
                $selection.set(this._item.extend(this.getRealId(changed[0])), true);
            }
            return $selection;
        });
        this._updatingSelection = false;
    }

    updateFromFileOrder() {
        if (!this._sortable || this._sortableLevel !== ListLevel.FILE) {
            return;
        }

        const fileOrder_ = get(fileOrder);
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

        const fileOrder_ = get(fileOrder);
        const sortableOrder = this._sortable.toArray();

        if (
            fileOrder_.length !== sortableOrder.length ||
            fileOrder_.some((value, index) => value !== sortableOrder[index])
        ) {
            fileOrder.set(sortableOrder);
        }
    }

    updateElements() {
        this._elements = {};
        this._container.childNodes.forEach((element) => {
            if (element instanceof HTMLElement) {
                let attr = element.getAttribute('data-id');
                if (attr) {
                    if (this._node instanceof Map && !this._node.has(attr)) {
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
        let changed: (string | number)[] = [];
        const selection_ = get(selection);
        Object.entries(this._elements).forEach(([id, element]) => {
            let realId = this.getRealId(id);
            let realItem = this._item.extend(realId);
            let inSelection = selection_.has(realItem);
            let isSelected = element.classList.contains('sortable-selected');
            if (inSelection !== isSelected) {
                changed.push(realId);
            }
        });
        return changed;
    }

    getRealId(id: string | number) {
        return this._sortableLevel === ListLevel.FILE || this._sortableLevel === ListLevel.WAYPOINTS
            ? id
            : parseInt(id as string);
    }
}
