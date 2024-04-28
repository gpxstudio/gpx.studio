<script lang="ts">
	import { map, files, selectedFiles, getFileStore, gpxLayers } from '$lib/stores';
	import { GPXLayer } from './GPXLayer';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import WaypointPopup from './WaypointPopup.svelte';

	let popupElement: HTMLElement;
	let popup: mapboxgl.Popup | null = null;

	$: if ($map) {
		gpxLayers.update(($layers) => {
			// remove layers for deleted files
			$layers.forEach((layer, file) => {
				if (!get(files).includes(file)) {
					layer.remove();
					$layers.delete(file);
				}
			});
			// add layers for new files
			$files.forEach((file) => {
				if (!$layers.has(file)) {
					$layers.set(file, new GPXLayer(get(map), file, popup, popupElement));
				}
			});
			return $layers;
		});
	}

	$: $selectedFiles.forEach((file) => {
		let fileStore = getFileStore(file);
		if ($gpxLayers.has(fileStore)) {
			$gpxLayers.get(fileStore)?.moveToFront();
		}
	});

	onMount(() => {
		popup = new mapboxgl.Popup({
			closeButton: false,
			maxWidth: undefined
		});
		popup.setDOMContent(popupElement);
		popupElement.classList.remove('hidden');
	});
</script>

<WaypointPopup bind:element={popupElement} />
