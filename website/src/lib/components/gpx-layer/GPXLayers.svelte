<script lang="ts">
	import { map, gpxLayers } from '$lib/stores';
	import { GPXLayer } from './GPXLayer';
	import { get } from 'svelte/store';
	import WaypointPopup from './WaypointPopup.svelte';
	import { fileObservers } from '$lib/db';
	import { DistanceMarkers } from './DistanceMarkers';
	import { StartEndMarkers } from './StartEndMarkers';

	let distanceMarkers: DistanceMarkers;
	let startEndMarkers: StartEndMarkers;

	$: if ($map && $fileObservers) {
		// remove layers for deleted files
		gpxLayers.forEach((layer, fileId) => {
			if (!$fileObservers.has(fileId)) {
				layer.remove();
				gpxLayers.delete(fileId);
			}
		});
		// add layers for new files
		$fileObservers.forEach((file, fileId) => {
			if (!gpxLayers.has(fileId)) {
				gpxLayers.set(fileId, new GPXLayer(get(map), fileId, file));
			}
		});
	}

	$: if ($map) {
		distanceMarkers = new DistanceMarkers(get(map));
		startEndMarkers = new StartEndMarkers(get(map));
	}
</script>

<WaypointPopup />
