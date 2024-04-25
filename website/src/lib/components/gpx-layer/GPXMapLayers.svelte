<script lang="ts">
	import { map, files, selectedFiles, getFileStore } from '$lib/stores';
	import type { GPXFile } from 'gpx';
	import { GPXMapLayer } from './GPXMapLayers';
	import { get, type Writable } from 'svelte/store';

	let gpxLayers: Map<Writable<GPXFile>, GPXMapLayer> = new Map();

	$: if ($map) {
		gpxLayers.forEach((layer, file) => {
			if (!get(files).includes(file)) {
				layer.remove();
				gpxLayers.delete(file);
			}
		});
		$files.forEach((file) => {
			if (!gpxLayers.has(file)) {
				gpxLayers.set(file, new GPXMapLayer(get(map), file));
			}
		});
	}

	$: $selectedFiles.forEach((file) => {
		let fileStore = getFileStore(file);
		if (gpxLayers.has(fileStore)) {
			gpxLayers.get(fileStore)?.moveToFront();
		}
	});
</script>
