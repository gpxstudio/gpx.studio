import { writable, get, type Writable, derived } from 'svelte/store';

import mapboxgl from 'mapbox-gl';
import { GPXFile, buildGPX, parseGPX, GPXStatistics, type Coordinates } from 'gpx';
import { tick } from 'svelte';
import { _ } from 'svelte-i18n';
import type { GPXLayer } from '$lib/components/gpx-layer/GPXLayer';
import { dbUtils, fileObservers, getFile, getStatistics, settings } from './db';
import {
    addSelectItem,
    applyToOrderedSelectedItemsFromFile,
    selectFile,
    selectItem,
    selection,
} from '$lib/components/file-list/Selection';
import {
    ListFileItem,
    ListItem,
    ListTrackItem,
    ListTrackSegmentItem,
    ListWaypointItem,
    ListWaypointsItem,
} from '$lib/components/file-list/FileList';
import type { RoutingControls } from '$lib/components/toolbar/tools/routing/RoutingControls';
import { SplitType } from '$lib/components/toolbar/tools/scissors/Scissors.svelte';
import FileSaver from 'file-saver';
import JSZip from 'jszip';

const { fileOrder } = settings;

export const map = writable<mapboxgl.Map | null>(null);
export const embedding = writable(false);
export const selectFiles = writable<{ [key: string]: (fileId?: string) => void }>({});

export const gpxStatistics: Writable<GPXStatistics> = writable(new GPXStatistics());
export const slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined> =
    writable(undefined);

export function updateGPXData() {
    const statistics = new GPXStatistics();
    applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
        const stats = getStatistics(fileId);
        if (stats) {
            let first = true;
            items.forEach((item) => {
                if (
                    !(item instanceof ListWaypointItem || item instanceof ListWaypointsItem) ||
                    first
                ) {
                    statistics.mergeWith(stats.getStatisticsFor(item));
                    first = false;
                }
            });
        }
    }, false);
    gpxStatistics.set(statistics);
}

const unsubscribes: Map<string, () => void> = new Map();
selection.subscribe(($selection) => {
    // Maintain up-to-date statistics for the current selection
    updateGPXData();

    while (unsubscribes.size > 0) {
        const nextEntry = unsubscribes.entries().next().value;
        if (nextEntry) {
            const [fileId, unsubscribe] = nextEntry;
            unsubscribe();
            unsubscribes.delete(fileId);
        } else {
            break;
        }
    }

    $selection.forEach((item) => {
        const fileId = item.getFileId();
        if (!unsubscribes.has(fileId)) {
            const fileObserver = get(fileObservers).get(fileId);
            if (fileObserver) {
                let first = true;
                unsubscribes.set(
                    fileId,
                    fileObserver.subscribe(() => {
                        if (first) first = false;
                        else updateGPXData();
                    })
                );
            }
        }
    });
});

gpxStatistics.subscribe(() => {
    slicedGPXStatistics.set(undefined);
});

const targetMapBounds = writable<{
    bounds: mapboxgl.LngLatBounds;
    ids: string[];
    total: number;
}>({
    bounds: new mapboxgl.LngLatBounds([180, 90, -180, -90]),
    ids: [],
    total: 0,
});

derived([targetMapBounds, map], (x) => x).subscribe(([bounds, $map]) => {
    if (
        $map === null ||
        bounds.ids.length > 0 ||
        (bounds.bounds.getSouth() === 90 &&
            bounds.bounds.getWest() === 180 &&
            bounds.bounds.getNorth() === -90 &&
            bounds.bounds.getEast() === -180)
    ) {
        return;
    }

    const currentZoom = $map.getZoom();
    const currentBounds = $map.getBounds();
    if (
        bounds.total !== get(fileObservers).size &&
        currentBounds &&
        currentZoom > 2 // Extend current bounds only if the map is zoomed in
    ) {
        // There are other files on the map
        if (
            currentBounds.contains(bounds.bounds.getSouthEast()) &&
            currentBounds.contains(bounds.bounds.getNorthWest())
        ) {
            return;
        }

        bounds.bounds.extend(currentBounds.getSouthWest());
        bounds.bounds.extend(currentBounds.getNorthEast());
    }

    $map.fitBounds(bounds.bounds, { padding: 80, linear: true, easing: () => 1 });
});

export function initTargetMapBounds(ids: string[]) {
    targetMapBounds.set({
        bounds: new mapboxgl.LngLatBounds([180, 90, -180, -90]),
        ids,
        total: ids.length,
    });
}

export function updateTargetMapBounds(
    id: string,
    bounds: { southWest: Coordinates; northEast: Coordinates }
) {
    if (get(targetMapBounds).ids.indexOf(id) === -1) {
        return;
    }

    targetMapBounds.update((target) => {
        target.ids = target.ids.filter((x) => x !== id);
        if (
            bounds.southWest.lat !== 90 ||
            bounds.southWest.lon !== 180 ||
            bounds.northEast.lat !== -90 ||
            bounds.northEast.lon !== -180
        ) {
            // Avoid update for empty (new) files
            target.bounds.extend(bounds.southWest);
            target.bounds.extend(bounds.northEast);
        }

        return target;
    });
}

export function centerMapOnSelection() {
    const selected = get(selection).getSelected();
    const bounds = new mapboxgl.LngLatBounds();

    if (selected.find((item) => item instanceof ListWaypointItem)) {
        applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
            const file = getFile(fileId);
            if (file) {
                items.forEach((item) => {
                    if (item instanceof ListWaypointItem) {
                        const waypoint = file.wpt[item.getWaypointIndex()];
                        if (waypoint) {
                            bounds.extend([waypoint.getLongitude(), waypoint.getLatitude()]);
                        }
                    }
                });
            }
        });
    } else {
        const selectionBounds = get(gpxStatistics).global.bounds;
        bounds.setNorthEast(selectionBounds.northEast);
        bounds.setSouthWest(selectionBounds.southWest);
    }

    get(map)?.fitBounds(bounds, {
        padding: 80,
        easing: () => 1,
        maxZoom: 15,
    });
}

export const gpxLayers: Map<string, GPXLayer> = new Map();
export const routingControls: Map<string, RoutingControls> = new Map();

export enum Tool {
    ROUTING,
    WAYPOINT,
    SCISSORS,
    TIME,
    MERGE,
    EXTRACT,
    ELEVATION,
    REDUCE,
    CLEAN,
}
export const currentTool = writable<Tool | null>(null);
export const splitAs = writable(SplitType.FILES);
export const streetViewEnabled = writable(false);

export function newGPXFile() {
    const newFileName = get(_)('menu.new_file');

    const file = new GPXFile();

    let maxNewFileNumber = 0;
    get(fileObservers).forEach((f) => {
        const file = get(f)?.file;
        if (file && file.metadata.name && file.metadata.name.startsWith(newFileName)) {
            const number = parseInt(file.metadata.name.split(' ').pop() ?? '0');
            if (!isNaN(number) && number > maxNewFileNumber) {
                maxNewFileNumber = number;
            }
        }
    });

    file.metadata.name = `${newFileName} ${maxNewFileNumber + 1}`;

    return file;
}

export function createFile() {
    const file = newGPXFile();

    dbUtils.add(file);

    selectFileWhenLoaded(file._data.id);
    currentTool.set(Tool.ROUTING);
}

export function triggerFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gpx';
    input.multiple = true;
    input.className = 'hidden';
    input.onchange = () => {
        if (input.files) {
            loadFiles(input.files);
        }
    };
    input.click();
}

export async function loadFiles(list: FileList | File[]) {
    const files: GPXFile[] = [];
    for (let i = 0; i < list.length; i++) {
        const file = await loadFile(list[i]);
        if (file) {
            files.push(file);
        }
    }

    const ids = dbUtils.addMultiple(files);

    initTargetMapBounds(ids);
    selectFileWhenLoaded(ids[0]);
}

export async function loadFile(file: File): Promise<GPXFile | null> {
    const result = await new Promise<GPXFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const data = reader.result?.toString() ?? null;
            if (data) {
                const gpx = parseGPX(data);
                if (gpx.metadata === undefined) {
                    gpx.metadata = {};
                }
                if (gpx.metadata.name === undefined || gpx.metadata.name.trim() === '') {
                    gpx.metadata.name = file.name.split('.').slice(0, -1).join('.');
                }
                resolve(gpx);
            } else {
                resolve(null);
            }
        };
        reader.readAsText(file);
    });
    return result;
}

export function selectFileWhenLoaded(fileId: string) {
    const unsubscribe = fileObservers.subscribe((files) => {
        if (files.has(fileId)) {
            tick().then(() => {
                selectFile(fileId);
            });
            unsubscribe();
        }
    });
}

export function updateSelectionFromKey(down: boolean, shift: boolean) {
    const selected = get(selection).getSelected();
    if (selected.length === 0) {
        return;
    }

    let next: ListItem | undefined = undefined;
    if (selected[0] instanceof ListFileItem) {
        const order = get(fileOrder);
        let limitIndex: number | undefined = undefined;
        selected.forEach((item) => {
            const index = order.indexOf(item.getFileId());
            if (
                limitIndex === undefined ||
                (down && index > limitIndex) ||
                (!down && index < limitIndex)
            ) {
                limitIndex = index;
            }
        });

        if (limitIndex !== undefined) {
            let nextIndex = down ? limitIndex + 1 : limitIndex - 1;

            while (true) {
                if (nextIndex < 0) {
                    nextIndex = order.length - 1;
                } else if (nextIndex >= order.length) {
                    nextIndex = 0;
                }

                if (nextIndex === limitIndex) {
                    break;
                }

                next = new ListFileItem(order[nextIndex]);
                if (!get(selection).has(next)) {
                    break;
                }

                nextIndex += down ? 1 : -1;
            }
        }
    } else if (
        selected[0] instanceof ListTrackItem &&
        selected[selected.length - 1] instanceof ListTrackItem
    ) {
        const fileId = selected[0].getFileId();
        const file = getFile(fileId);
        if (file) {
            const numberOfTracks = file.trk.length;
            const trackIndex = down
                ? selected[selected.length - 1].getTrackIndex()
                : selected[0].getTrackIndex();
            if (down && trackIndex < numberOfTracks - 1) {
                next = new ListTrackItem(fileId, trackIndex + 1);
            } else if (!down && trackIndex > 0) {
                next = new ListTrackItem(fileId, trackIndex - 1);
            }
        }
    } else if (
        selected[0] instanceof ListTrackSegmentItem &&
        selected[selected.length - 1] instanceof ListTrackSegmentItem
    ) {
        const fileId = selected[0].getFileId();
        const file = getFile(fileId);
        if (file) {
            const trackIndex = selected[0].getTrackIndex();
            const numberOfSegments = file.trk[trackIndex].trkseg.length;
            const segmentIndex = down
                ? selected[selected.length - 1].getSegmentIndex()
                : selected[0].getSegmentIndex();
            if (down && segmentIndex < numberOfSegments - 1) {
                next = new ListTrackSegmentItem(fileId, trackIndex, segmentIndex + 1);
            } else if (!down && segmentIndex > 0) {
                next = new ListTrackSegmentItem(fileId, trackIndex, segmentIndex - 1);
            }
        }
    } else if (
        selected[0] instanceof ListWaypointItem &&
        selected[selected.length - 1] instanceof ListWaypointItem
    ) {
        const fileId = selected[0].getFileId();
        const file = getFile(fileId);
        if (file) {
            const numberOfWaypoints = file.wpt.length;
            const waypointIndex = down
                ? selected[selected.length - 1].getWaypointIndex()
                : selected[0].getWaypointIndex();
            if (down && waypointIndex < numberOfWaypoints - 1) {
                next = new ListWaypointItem(fileId, waypointIndex + 1);
            } else if (!down && waypointIndex > 0) {
                next = new ListWaypointItem(fileId, waypointIndex - 1);
            }
        }
    }

    if (next && (!get(selection).has(next) || !shift)) {
        if (shift) {
            addSelectItem(next);
        } else {
            selectItem(next);
        }
    }
}

async function exportFiles(fileIds: string[], exclude: string[]) {
    if (fileIds.length > 1) {
        await exportFilesAsZip(fileIds, exclude);
    } else {
        const firstFileId = fileIds.at(0);
        if (firstFileId != null) {
            const file = getFile(firstFileId);
            if (file) {
                exportFile(file, exclude);
            }
        }
    }
}

export async function exportSelectedFiles(exclude: string[]) {
    const fileIds: string[] = [];
    applyToOrderedSelectedItemsFromFile(async (fileId, level, items) => {
        fileIds.push(fileId);
    });
    await exportFiles(fileIds, exclude);
}

export async function exportAllFiles(exclude: string[]) {
    await exportFiles(get(fileOrder), exclude);
}

function exportFile(file: GPXFile, exclude: string[]) {
    const blob = new Blob([buildGPX(file, exclude)], { type: 'application/gpx+xml' });
    FileSaver.saveAs(blob, `${file.metadata.name}.gpx`);
}

async function exportFilesAsZip(fileIds: string[], exclude: string[]) {
    const zip = new JSZip();
    for (const fileId of fileIds) {
        const file = getFile(fileId);
        if (file) {
            const gpx = buildGPX(file, exclude);
            let filename = file.metadata.name;
            for (let i = 1; zip.files[filename + '.gpx']; i++) {
                filename = file.metadata.name + `-${i}`;
            }
            zip.file(filename + '.gpx', gpx);
        }
    }
    if (Object.keys(zip.files).length > 0) {
        const blob = await zip.generateAsync({ type: 'blob' });
        FileSaver.saveAs(blob, 'gpx-files.zip');
    }
}

export const allHidden = writable(false);

export function updateAllHidden() {
    let hidden = true;
    applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
        const file = getFile(fileId);
        if (file) {
            for (const item of items) {
                if (!hidden) {
                    return;
                }

                if (item instanceof ListFileItem) {
                    hidden = hidden && file._data.hidden === true;
                } else if (
                    item instanceof ListTrackItem &&
                    item.getTrackIndex() < file.trk.length
                ) {
                    hidden = hidden && file.trk[item.getTrackIndex()]._data.hidden === true;
                } else if (
                    item instanceof ListTrackSegmentItem &&
                    item.getTrackIndex() < file.trk.length &&
                    item.getSegmentIndex() < file.trk[item.getTrackIndex()].trkseg.length
                ) {
                    hidden =
                        hidden &&
                        file.trk[item.getTrackIndex()].trkseg[item.getSegmentIndex()]._data
                            .hidden === true;
                } else if (item instanceof ListWaypointsItem) {
                    hidden = hidden && file._data.hiddenWpt === true;
                } else if (
                    item instanceof ListWaypointItem &&
                    item.getWaypointIndex() < file.wpt.length
                ) {
                    hidden = hidden && file.wpt[item.getWaypointIndex()]._data.hidden === true;
                }
            }
        }
    });
    allHidden.set(hidden);
}
selection.subscribe(updateAllHidden);

export const editMetadata = writable(false);
export const editStyle = writable(false);

export enum ExportState {
    NONE,
    SELECTION,
    ALL,
}
export const exportState = writable<ExportState>(ExportState.NONE);
