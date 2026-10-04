import { isMac } from '$lib/utils';
import Sortable, { type Direction } from 'sortablejs/Sortable';
import { ListLevel } from './file-list';
import { get, writable } from 'svelte/store';
import { tick } from 'svelte';
import { engine, type MoveTarget, type Selection } from '$lib/engine';
import { isSelected, type FileTreeNode } from '$lib/selection-helpers';

export const allowedMoves: Record<ListLevel, ListLevel[]> = {
    [ListLevel.ROOT]: [],
    [ListLevel.FILE]: [ListLevel.FILE],
    [ListLevel.TRACK]: [ListLevel.FILE, ListLevel.TRACK],
    [ListLevel.SEGMENT]: [ListLevel.FILE, ListLevel.TRACK, ListLevel.SEGMENT],
    [ListLevel.WAYPOINTS]: [ListLevel.WAYPOINTS],
    [ListLevel.WAYPOINT]: [ListLevel.WAYPOINTS, ListLevel.WAYPOINT],
};

export const dragging = writable<ListLevel | null>(null);

/** The list of each container, to find the lists a drop is about from its event. */
const lists = new WeakMap<HTMLElement, SortableFileList>();

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
    /** The elements of the list when a drag from it started, to put them back when it ends. */
    private _snapshot: ChildNode[] = [];
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
            onStart: () => {
                // all the nodes, not only the elements: the comments are the anchors of the Svelte blocks
                this._snapshot = Array.from(container.childNodes);
                dragging.set(sortableLevel);
            },
            onEnd: () => dragging.set(null),
            onSort: (e: Sortable.SortableEvent) => this.onSort(e),
        });
        lists.set(container, this);

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

    /** The elements of the list in the selection form. */
    private selectionOf(ids: string[]): Selection | undefined {
        const parent = this._parent;
        switch (this._sortableLevel) {
            case ListLevel.FILE:
                return { type: 'file', fileIds: ids };
            case ListLevel.TRACK:
                return parent ? { type: 'track', fileId: parent.fileId, trackIds: ids } : undefined;
            case ListLevel.SEGMENT:
                return parent?.type === 'track'
                    ? {
                          type: 'segment',
                          fileId: parent.fileId,
                          trackId: parent.trackId,
                          segmentIds: ids,
                      }
                    : undefined;
            case ListLevel.WAYPOINTS:
                return parent ? { type: 'waypoints', fileId: parent.fileId } : undefined;
            case ListLevel.WAYPOINT:
                return parent
                    ? { type: 'waypoint', fileId: parent.fileId, waypointIds: ids }
                    : undefined;
        }
    }

    /** A position in the list, as a place to move elements to. */
    private targetAt(index: number): MoveTarget | undefined {
        const parent = this._parent;
        switch (this._sortableLevel) {
            case ListLevel.FILE:
                return { type: 'files', index };
            case ListLevel.TRACK:
                return parent ? { type: 'tracks', fileId: parent.fileId, index } : undefined;
            case ListLevel.SEGMENT:
                return parent?.type === 'track'
                    ? { type: 'segments', fileId: parent.fileId, trackId: parent.trackId, index }
                    : undefined;
            case ListLevel.WAYPOINTS:
                // the list holds the node standing for the waypoints: they go after the others
                return parent
                    ? { type: 'waypoints', fileId: parent.fileId, index: Infinity }
                    : undefined;
            case ListLevel.WAYPOINT:
                return parent ? { type: 'waypoints', fileId: parent.fileId, index } : undefined;
        }
    }

    onSort(e: Sortable.SortableEvent) {
        const from = lists.get(e.from);
        const to = lists.get(e.to);
        if (!from || !to) {
            return;
        }

        if (from === to && this._sortableLevel === ListLevel.FILE) {
            // the order of the files is the one of the list
            this.updateToFileOrder();
            return;
        }

        // The event is triggered on the source and on the destination list: handle it once.
        // Nothing to move in the list of the single node of the waypoints.
        if (to !== this || (from === to && this._sortableLevel === ListLevel.WAYPOINTS)) {
            return;
        }

        const elements: HTMLElement[] = e.items.length > 0 ? e.items : [e.item];
        const ids = elements
            .map((element) => element.getAttribute('data-id'))
            .filter((id): id is string => id !== null);
        const newIndices = (
            e.newIndicies.length > 0
                ? e.newIndicies.map((i: { index: number }) => i.index)
                : [e.newIndex]
        ).filter((index: number | undefined): index is number => index !== undefined && index >= 0);
        const what = from.selectionOf(ids);
        const target = to.targetAt(newIndices.length > 0 ? Math.min(...newIndices) : Infinity);

        // The list is rendered from the state of the engine: put the elements back where they
        // were, the engine moves them for real.
        from._snapshot.forEach((node) => e.from.appendChild(node));

        if (what && target) {
            engine.move(what, target);
        }
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
