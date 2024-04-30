<script lang="ts">
	import { map, filestore, selectedFiles, gpxLayers } from '$lib/stores';
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
			$layers.forEach((layer, fileId) => {
				if (!get(filestore).find((file) => file._data.id === fileId)) {
					layer.remove();
					$layers.delete(fileId);
				}
			});
			// add layers for new files
			$filestore.forEach((file) => {
				if (!$layers.has(file._data.id)) {
					let fileStore = filestore.getFileStore(file._data.id);
					$layers.set(file._data.id, new GPXLayer(get(map), fileStore, popup, popupElement));
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
