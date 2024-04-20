<script context="module" lang="ts">
	let id = 0;
	function getLayerId() {
		return `gpx-${id++}`;
	}

	let defaultWeight = 6;
	let defaultOpacity = 1;

	const colors = [
		'#ff0000',
		'#0000ff',
		'#46e646',
		'#00ccff',
		'#ff9900',
		'#ff00ff',
		'#ffff32',
		'#288228',
		'#9933ff',
		'#50f0be',
		'#8c645a'
	];

	const colorCount: { [key: string]: number } = {};
	for (let color of colors) {
		colorCount[color] = 0;
	}

	// Get the color with the least amount of uses
	function getColor() {
		let color = colors.reduce((a, b) => (colorCount[a] <= colorCount[b] ? a : b));
		colorCount[color]++;
		return color;
	}

	function decrementColor(color: string) {
		colorCount[color]--;
	}
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { GPXFile } from 'gpx';
	import { map, selectedFiles, selectFiles } from '$lib/stores';
	import { get } from 'svelte/store';

	export let file: GPXFile;

	let layerId = getLayerId();
	let layerColor = getColor();

	function selectOnClick(e: any) {
		if (e.originalEvent.shiftKey) {
			get(selectFiles).addSelect(file);
		} else {
			get(selectFiles).select(file);
		}
	}

	function toPointerCursor() {
		if ($map) {
			$map.getCanvas().style.cursor = 'pointer';
		}
	}

	function toDefaultCursor() {
		if ($map) {
			$map.getCanvas().style.cursor = '';
		}
	}

	function addGPXLayer() {
		if ($map) {
			if (!$map.getSource(layerId)) {
				let data = file.toGeoJSON();

				for (let feature of data.features) {
					if (!feature.properties.color) {
						feature.properties.color = layerColor;
					}
					if (!feature.properties.weight) {
						feature.properties.weight = defaultWeight;
					}
					if (!feature.properties.opacity) {
						feature.properties.opacity = defaultOpacity;
					}
				}

				$map.addSource(layerId, {
					type: 'geojson',
					data
				});
			}
			if (!$map.getLayer(layerId)) {
				$map.addLayer({
					id: layerId,
					type: 'line',
					source: layerId,
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': ['get', 'color'],
						'line-width': ['get', 'weight'],
						'line-opacity': ['get', 'opacity']
					}
				});

				$map.on('click', layerId, selectOnClick);
				$map.on('mouseenter', layerId, toPointerCursor);
				$map.on('mouseleave', layerId, toDefaultCursor);
			}
		}
	}

	addGPXLayer();

	$: if ($map) {
		$map.on('style.load', () => {
			addGPXLayer();
		});
	}

	$: if ($selectedFiles.has(file)) {
		if ($map) {
			$map.moveLayer(layerId);
		}
	}

	onDestroy(() => {
		if ($map) {
			$map.off('click', layerId, selectOnClick);
			$map.off('mouseenter', layerId, toPointerCursor);
			$map.off('mouseleave', layerId, toDefaultCursor);

			$map.removeLayer(layerId);
			$map.removeSource(layerId);
		}
		decrementColor(layerColor);
	});
</script>
