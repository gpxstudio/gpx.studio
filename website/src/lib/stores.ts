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
