<script lang="ts">
	import { map, gpxLayers } from '$lib/stores';
	import { GPXLayer } from './GPXLayer';
	import { get } from 'svelte/store';
	import WaypointPopup from './WaypointPopup.svelte';
	import { fileObservers } from '$lib/db';
	import { selection } from '$lib/components/file-list/Selection';

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

	$: $selection.forEach((item) => {
		let fileId = item.getFileId();
		// TODO move more precise selection to front?
		if ($gpxLayers.has(fileId)) {
			$gpxLayers.get(fileId)?.moveToFront();
		}
	});
</script>

<WaypointPopup />
