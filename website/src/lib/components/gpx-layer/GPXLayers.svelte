<script lang="ts">
	import { map, selectedFiles, gpxLayers } from '$lib/stores';
	import { GPXLayer } from './GPXLayer';
	import { get } from 'svelte/store';
	import WaypointPopup from './WaypointPopup.svelte';
	import { fileObservers } from '$lib/db';

	$: if ($map && $fileObservers) {
		gpxLayers.update(($layers) => {
			// remove layers for deleted files
			$layers.forEach((layer, fileId) => {
				if (!$fileObservers.has(fileId)) {
					layer.remove();
					$layers.delete(fileId);
				}
			});
			// add layers for new files
			$fileObservers.forEach((file, fileId) => {
				if (!$layers.has(fileId)) {
					$layers.set(fileId, new GPXLayer(get(map), fileId, file));
				}
			});
			return $layers;
		});
	}

	$: $selectedFiles.forEach((fileId) => {
		if ($gpxLayers.has(fileId)) {
			$gpxLayers.get(fileId)?.moveToFront();
		}
	});
</script>

<WaypointPopup />
