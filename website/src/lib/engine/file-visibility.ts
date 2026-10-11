import type { FileStructure } from 'gpx-rs';

/**
 * Visibility the user set explicitly, by element id (file, track, segment, waypoint, or the
 * waypoints of the file as a whole, see `waypointsKey`): `false` hides, `true` shows. An element
 * without entry follows its parent, and everything is shown by default.
 */
export type Visibility = ReadonlyMap<string, boolean>;

/** What is needed to tell whether the elements of a file are hidden (a `FileState` fits). */
export type VisibilityState = { structure: FileStructure; visibility: Visibility };

/** Id to hide or show all the waypoints of a file at once. */
export function waypointsKey(fileId: string): string {
    return `${fileId}:waypoints`;
}

/** Ids from the file down to `id` in the file tree (file, tracks, segments / waypoints group). */
function pathTo(structure: FileStructure, id: string): string[] {
    const fileId = structure.id;
    if (id === fileId) {
        return [fileId];
    }
    if (id === waypointsKey(fileId)) {
        return [fileId, id];
    }
    if (structure.waypoints.some((waypoint) => waypoint.id === id)) {
        return [fileId, waypointsKey(fileId), id];
    }
    for (const track of structure.tracks) {
        if (track.id === id) {
            return [fileId, id];
        }
        if (track.segments.some((segment) => segment.id === id)) {
            return [fileId, track.id, id];
        }
    }
    return [];
}

function children(structure: FileStructure, id: string): string[] {
    if (id === structure.id) {
        return [waypointsKey(id), ...structure.tracks.map((track) => track.id)];
    }
    if (id === waypointsKey(structure.id)) {
        return structure.waypoints.map((waypoint) => waypoint.id);
    }
    return structure.tracks.find((track) => track.id === id)?.segments.map((s) => s.id) ?? [];
}

function descendants(structure: FileStructure, id: string): string[] {
    return children(structure, id).flatMap((child) => [child, ...descendants(structure, child)]);
}

/** The closest explicit visibility on a path (from the file down): whether it is hidden. */
function followsHidden(visibility: Visibility, path: string[]): boolean {
    for (let i = path.length - 1; i >= 0; i--) {
        const shown = visibility.get(path[i]);
        if (shown !== undefined) {
            return !shown;
        }
    }
    return false;
}

/**
 * Whether an element is hidden: its closest explicit ancestor (or itself) is hidden, and none
 * of its descendants was shown. A file whose only visible segment was shown on its own is not
 * hidden, its other segments are. Unknown ids are not hidden.
 */
export function isHidden({ structure, visibility }: VisibilityState, id: string): boolean {
    return (
        followsHidden(visibility, pathTo(structure, id)) &&
        !descendants(structure, id).some((descendant) => visibility.get(descendant) === true)
    );
}

// Leaf elements have no descendants: no need to look at the structure.

export function isSegmentHidden(
    { structure, visibility }: VisibilityState,
    trackId: string,
    segmentId: string
): boolean {
    return followsHidden(visibility, [structure.id, trackId, segmentId]);
}

export function isWaypointHidden(
    { structure, visibility }: VisibilityState,
    waypointId: string
): boolean {
    return followsHidden(visibility, [structure.id, waypointsKey(structure.id), waypointId]);
}

/**
 * Hides or shows elements of a file, and returns the new visibility. What was set explicitly
 * below these elements is reset, so that hiding a file then showing one of its segments leaves
 * only that segment visible, and hiding the file again hides all of it.
 */
export function setHidden(
    structure: FileStructure,
    visibility: Visibility,
    ids: string[],
    hidden: boolean
): Visibility {
    const next = new Map(visibility);
    ids.forEach((id) => {
        descendants(structure, id).forEach((child) => next.delete(child));
        next.set(id, !hidden);
    });
    return next;
}

/** Name under which the visibility of the files is kept in the storage. */
export const VISIBILITY_KEY = 'visibility';

/**
 * The visibility of the files as JSON, to keep it: the explicit visibility of each file by id,
 * leaving out the files that `keep` refuses (the ones that are gone) and the ones that have none.
 * `undefined` when there is nothing to keep.
 */
export function stringifyVisibility(
    files: ReadonlyMap<string, Visibility>,
    keep: (fileId: string) => boolean
): string | undefined {
    const data: Record<string, Record<string, boolean>> = {};
    files.forEach((visibility, fileId) => {
        if (visibility.size > 0 && keep(fileId)) {
            data[fileId] = Object.fromEntries(visibility);
        }
    });
    return Object.keys(data).length > 0 ? JSON.stringify(data) : undefined;
}

/** What `stringifyVisibility` gave back. What does not make sense is left out. */
export function parseVisibility(json: string | undefined): Map<string, Visibility> {
    const files = new Map<string, Visibility>();
    if (json === undefined) {
        return files;
    }
    try {
        const data: unknown = JSON.parse(json);
        if (typeof data !== 'object' || data === null) {
            return files;
        }
        for (const [fileId, entries] of Object.entries(data)) {
            if (typeof entries !== 'object' || entries === null) {
                continue;
            }
            const visibility = new Map<string, boolean>();
            for (const [id, shown] of Object.entries(entries)) {
                if (typeof shown === 'boolean') {
                    visibility.set(id, shown);
                }
            }
            if (visibility.size > 0) {
                files.set(fileId, visibility);
            }
        }
    } catch {
        // not something that was kept
    }
    return files;
}
