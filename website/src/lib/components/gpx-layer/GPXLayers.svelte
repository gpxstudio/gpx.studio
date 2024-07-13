<script lang="ts">
	import { map, gpxLayers } from '$lib/stores';
	import { GPXLayer } from './GPXLayer';
	import WaypointPopup from './WaypointPopup.svelte';
	import { fileObservers } from '$lib/db';
	import { DistanceMarkers } from './DistanceMarkers';
	import { StartEndMarkers } from './StartEndMarkers';
	import { onDestroy } from 'svelte';

	let distanceMarkers: DistanceMarkers | undefined = undefined;
	let startEndMarkers: StartEndMarkers | undefined = undefined;

	$: if ($map && $fileObservers) {
		// remove layers for deleted files
		gpxLayers.forEach((layer, fileId) => {
			if (!$fileObservers.has(fileId)) {
				layer.remove();
				gpxLayers.delete(fileId);
			} else if ($map !== layer.map) {
				layer.updateMap($map);
			}
		});
		// add layers for new files
		$fileObservers.forEach((file, fileId) => {
			if (!gpxLayers.has(fileId)) {
				gpxLayers.set(fileId, new GPXLayer($map, fileId, file));
			}
		});
	}

	$: if ($map) {
		if (distanceMarkers) {
			distanceMarkers.remove();
		}
		if (startEndMarkers) {
			startEndMarkers.remove();
		}
		distanceMarkers = new DistanceMarkers($map);
		startEndMarkers = new StartEndMarkers($map);
	}

	onDestroy(() => {
		gpxLayers.forEach((layer) => layer.remove());
		gpxLayers.clear();

		if (distanceMarkers) {
			distanceMarkers.remove();
			distanceMarkers = undefined;
		}

		if (startEndMarkers) {
			startEndMarkers.remove();
			startEndMarkers = undefined;
		}
	});
</script>

<WaypointPopup />
