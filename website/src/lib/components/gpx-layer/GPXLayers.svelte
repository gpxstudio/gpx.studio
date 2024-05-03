<script lang="ts">
	import { map, selectedFiles, gpxLayers } from '$lib/stores';
	import { GPXLayer } from './GPXLayer';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import WaypointPopup from './WaypointPopup.svelte';
	import { fileObservers } from '$lib/db';

	let popupElement: HTMLElement;
	let popup: mapboxgl.Popup | null = null;

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
					$layers.set(fileId, new GPXLayer(get(map), fileId, file, popup, popupElement));
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
