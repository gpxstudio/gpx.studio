// import { writable, get, type Writable } from 'svelte/store';

// import { GPXFile, parseGPX, GPXStatistics } from 'gpx';
// import { tick } from 'svelte';
// import { i18n } from '$lib/i18n.svelte';
// import type { GPXLayer } from '$lib/components/map/gpx-layer/GPXLayer';
// import { dbUtils, fileObservers, getFile, getStatistics } from '$lib/db';
// import {
//     applyToOrderedSelectedItemsFromFile,
//     selectFile,
//     selection,
// } from '$lib/components/file-list/Selection';
// import {
//     ListFileItem,
//     ListTrackItem,
//     ListTrackSegmentItem,
//     ListWaypointItem,
//     ListWaypointsItem,
// } from '$lib/components/file-list/FileList';
// import type { RoutingControls } from '$lib/components/toolbar/tools/routing/RoutingControls';

// export const embedding = writable(false);
// export const selectFiles = writable<{ [key: string]: (fileId?: string) => void }>({});

// export const gpxStatistics: Writable<GPXStatistics> = writable(new GPXStatistics());
// export const slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined> =
//     writable(undefined);

// export function updateGPXData() {
//     let statistics = new GPXStatistics();
//     applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
//         let stats = getStatistics(fileId);
//         if (stats) {
//             let first = true;
//             items.forEach((item) => {
//                 if (
//                     !(item instanceof ListWaypointItem || item instanceof ListWaypointsItem) ||
//                     first
//                 ) {
//                     statistics.mergeWith(stats.getStatisticsFor(item));
//                     first = false;
//                 }
//             });
//         }
//     }, false);
//     gpxStatistics.set(statistics);
// }

// let unsubscribes: Map<string, () => void> = new Map();
// selection.subscribe(($selection) => {
//     // Maintain up-to-date statistics for the current selection
//     updateGPXData();

//     while (unsubscribes.size > 0) {
//         let [fileId, unsubscribe] = unsubscribes.entries().next().value;
//         unsubscribe();
//         unsubscribes.delete(fileId);
//     }

//     $selection.forEach((item) => {
//         let fileId = item.getFileId();
//         if (!unsubscribes.has(fileId)) {
//             let fileObserver = get(fileObservers).get(fileId);
//             if (fileObserver) {
//                 let first = true;
//                 unsubscribes.set(
//                     fileId,
//                     fileObserver.subscribe(() => {
//                         if (first) first = false;
//                         else updateGPXData();
//                     })
//                 );
//             }
//         }
//     });
// });

// gpxStatistics.subscribe(() => {
//     slicedGPXStatistics.set(undefined);
// });

// export const gpxLayers: Map<string, GPXLayer> = new Map();
// export const routingControls: Map<string, RoutingControls> = new Map();

// export function selectFileWhenLoaded(fileId: string) {
//     const unsubscribe = fileObservers.subscribe((files) => {
//         if (files.has(fileId)) {
//             tick().then(() => {
//                 selectFile(fileId);
//             });
//             unsubscribe();
//         }
//     });
// }

// export const allHidden = writable(false);

// export function updateAllHidden() {
//     let hidden = true;
//     applyToOrderedSelectedItemsFromFile((fileId, level, items) => {
//         let file = getFile(fileId);
//         if (file) {
//             for (let item of items) {
//                 if (!hidden) {
//                     return;
//                 }

//                 if (item instanceof ListFileItem) {
//                     hidden = hidden && file._data.hidden === true;
//                 } else if (
//                     item instanceof ListTrackItem &&
//                     item.getTrackIndex() < file.trk.length
//                 ) {
//                     hidden = hidden && file.trk[item.getTrackIndex()]._data.hidden === true;
//                 } else if (
//                     item instanceof ListTrackSegmentItem &&
//                     item.getTrackIndex() < file.trk.length &&
//                     item.getSegmentIndex() < file.trk[item.getTrackIndex()].trkseg.length
//                 ) {
//                     hidden =
//                         hidden &&
//                         file.trk[item.getTrackIndex()].trkseg[item.getSegmentIndex()]._data
//                             .hidden === true;
//                 } else if (item instanceof ListWaypointsItem) {
//                     hidden = hidden && file._data.hiddenWpt === true;
//                 } else if (
//                     item instanceof ListWaypointItem &&
//                     item.getWaypointIndex() < file.wpt.length
//                 ) {
//                     hidden = hidden && file.wpt[item.getWaypointIndex()]._data.hidden === true;
//                 }
//             }
//         }
//     });
//     allHidden.set(hidden);
// }
// selection.subscribe(updateAllHidden);
