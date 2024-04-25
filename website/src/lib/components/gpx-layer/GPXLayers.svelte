<script lang="ts">
	import { map, files, selectedFiles, getFileStore } from '$lib/stores';
	import type { GPXFile } from 'gpx';
	import { GPXLayer } from './GPXLayer';
	import { get, type Writable } from 'svelte/store';

	let gpxLayers: Map<Writable<GPXFile>, GPXLayer> = new Map();

	$: if ($map) {
		// remove layers for deleted files
		gpxLayers.forEach((layer, file) => {
			if (!get(files).includes(file)) {
				layer.remove();
				gpxLayers.delete(file);
			}
		});
		// add layers for new files
		$files.forEach((file) => {
			if (!gpxLayers.has(file)) {
				gpxLayers.set(file, new GPXLayer(get(map), file));
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
