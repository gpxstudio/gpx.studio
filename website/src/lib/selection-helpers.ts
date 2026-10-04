import type { Clipboard, Selection } from 'gpx-rs';
import { isHidden, waypointsKey, type VisibilityState } from '$lib/file-visibility';

/**
 * An element of the file tree, to ask questions about the selection:
 *
 *     file ─┬─ track ─── segment
 *           └─ waypoints ─── waypoint
 *
 * `waypoints` is the node standing for all the waypoints of a file.
 */
export type FileTreeNode =
    | { type: 'file'; fileId: string }
    | { type: 'track'; fileId: string; trackId: string }
    | { type: 'segment'; fileId: string; trackId: string; segmentId: string }
    | { type: 'waypoints'; fileId: string }
    | { type: 'waypoint'; fileId: string; waypointId: string };

/**
 * The id of the element of a node, as used by the visibility (`waypointsKey` for the waypoints
 * node).
 */
export function elementId(node: FileTreeNode): string {
    switch (node.type) {
        case 'file':
            return node.fileId;
        case 'track':
            return node.trackId;
        case 'segment':
            return node.segmentId;
        case 'waypoints':
            return waypointsKey(node.fileId);
        case 'waypoint':
            return node.waypointId;
    }
}

export function isEmpty(selection: Selection): boolean {
    return selection.type === 'empty';
}

/** Ids of the files holding something selected (or selected themselves). */
export function selectedFileIds(selection: Selection): string[] {
    switch (selection.type) {
        case 'empty':
            return [];
        case 'file':
            return selection.fileIds;
        default:
            return [selection.fileId];
    }
}

/** Whether the node is one of the elements in the clipboard. */
export function isInClipboard(clipboard: Clipboard | undefined, node: FileTreeNode): boolean {
    if (!clipboard) {
        return false;
    }
    switch (node.type) {
        case 'file':
            return clipboard.type === 'files' && clipboard.ids.includes(node.fileId);
        case 'track':
            return clipboard.type === 'tracks' && clipboard.ids.includes(node.trackId);
        case 'segment':
            return clipboard.type === 'segments' && clipboard.ids.includes(node.segmentId);
        case 'waypoint':
            return clipboard.type === 'waypoints' && clipboard.ids.includes(node.waypointId);
        case 'waypoints':
            return false;
    }
}

/** Number of selected elements (the waypoints node counts for one). */
export function selectionSize(selection: Selection): number {
    switch (selection.type) {
        case 'empty':
            return 0;
        case 'file':
            return selection.fileIds.length;
        case 'track':
            return selection.trackIds.length;
        case 'segment':
            return selection.segmentIds.length;
        case 'waypoints':
            return 1;
        case 'waypoint':
            return selection.waypointIds.length;
    }
}

/**
 * The ids of the selected elements, by file, as used by the visibility (a file, its tracks, its
 * segments, its waypoints, or `waypointsKey` for the waypoints node).
 */
export function selectedElementIds(selection: Selection): { fileId: string; ids: string[] }[] {
    switch (selection.type) {
        case 'empty':
            return [];
        case 'file':
            return selection.fileIds.map((fileId) => ({ fileId, ids: [fileId] }));
        case 'track':
            return [{ fileId: selection.fileId, ids: selection.trackIds }];
        case 'segment':
            return [{ fileId: selection.fileId, ids: selection.segmentIds }];
        case 'waypoints':
            return [{ fileId: selection.fileId, ids: [waypointsKey(selection.fileId)] }];
        case 'waypoint':
            return [{ fileId: selection.fileId, ids: selection.waypointIds }];
    }
}

/** Whether the node itself is selected. */
export function isSelected(selection: Selection, node: FileTreeNode): boolean {
    switch (node.type) {
        case 'file':
            return selection.type === 'file' && selection.fileIds.includes(node.fileId);
        case 'track':
            return (
                selection.type === 'track' &&
                selection.fileId === node.fileId &&
                selection.trackIds.includes(node.trackId)
            );
        case 'segment':
            return (
                selection.type === 'segment' &&
                selection.fileId === node.fileId &&
                selection.trackId === node.trackId &&
                selection.segmentIds.includes(node.segmentId)
            );
        case 'waypoints':
            return selection.type === 'waypoints' && selection.fileId === node.fileId;
        case 'waypoint':
            return (
                selection.type === 'waypoint' &&
                selection.fileId === node.fileId &&
                selection.waypointIds.includes(node.waypointId)
            );
    }
}

/** The parent of a node, `undefined` for a file. */
function parent(node: FileTreeNode): FileTreeNode | undefined {
    switch (node.type) {
        case 'file':
            return undefined;
        case 'track':
        case 'waypoints':
            return { type: 'file', fileId: node.fileId };
        case 'segment':
            return { type: 'track', fileId: node.fileId, trackId: node.trackId };
        case 'waypoint':
            return { type: 'waypoints', fileId: node.fileId };
    }
}

/** Whether the node, or one of its ancestors, is selected: the node is covered by the selection. */
export function isCovered(selection: Selection, node: FileTreeNode): boolean {
    for (let n: FileTreeNode | undefined = node; n; n = parent(n)) {
        if (isSelected(selection, n)) {
            return true;
        }
    }
    return false;
}

/** Whether the node, or one of its descendants, is selected. */
export function hasSelectionWithin(selection: Selection, node: FileTreeNode): boolean {
    switch (node.type) {
        case 'file':
            return selectedFileIds(selection).includes(node.fileId);
        case 'track':
            return (
                isSelected(selection, node) ||
                (selection.type === 'segment' &&
                    selection.fileId === node.fileId &&
                    selection.trackId === node.trackId)
            );
        case 'waypoints':
            return (
                isSelected(selection, node) ||
                (selection.type === 'waypoint' && selection.fileId === node.fileId)
            );
        case 'segment':
        case 'waypoint':
            return isSelected(selection, node);
    }
}

/**
 * Whether all the selected elements are hidden (false when nothing is selected). `states` holds
 * the files by id: an element of an unknown file is not hidden.
 */
export function isSelectionHidden(
    selection: Selection,
    states: ReadonlyMap<string, VisibilityState>
): boolean {
    const selected = selectedElementIds(selection);
    return (
        selected.length > 0 &&
        selected.every(({ fileId, ids }) => {
            const state = states.get(fileId);
            return state !== undefined && ids.every((id) => isHidden(state, id));
        })
    );
}
