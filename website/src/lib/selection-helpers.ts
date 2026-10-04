import type { Selection } from 'gpx-rs';

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
