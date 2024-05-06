<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import LayerTree from './LayerTree.svelte';
	import LayerControlSettings from './LayerControlSettings.svelte';

	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import { Layers } from 'lucide-svelte';

	import { basemaps, overlays, opacities } from '$lib/assets/layers';
	import { settings } from '$lib/db';
	import { map } from '$lib/stores';
	import { get, writable } from 'svelte/store';
	import { getLayers } from './utils';

	const {
		currentBasemap,
		previousBasemap,
		currentOverlays,
		selectedBasemapTree,
		selectedOverlayTree
	} = settings;

	$: if ($map) {
		// Set style depending on the current basemap
		$map.setStyle(basemaps[$currentBasemap], {
			diff: false
		});
	}

	$: if ($map && $currentOverlays) {
		// Add or remove overlay layers depending on the current overlays
		let overlayLayers = getLayers($currentOverlays);
		Object.keys(overlayLayers).forEach((id) => {
			if (overlayLayers[id]) {
				if (!addOverlayLayer.hasOwnProperty(id)) {
					addOverlayLayer[id] = addOverlayLayerForId(id);
				}
				if (!$map.getLayer(id)) {
					addOverlayLayer[id]();
					$map.on('style.load', addOverlayLayer[id]);
				}
			} else if ($map.getLayer(id)) {
				$map.removeLayer(id);
				$map.off('style.load', addOverlayLayer[id]);
			}
		});
	}

	let selectedBasemap = writable(get(currentBasemap));
	selectedBasemap.subscribe((value) => {
		// Updates coming from radio buttons
		if (value !== get(currentBasemap)) {
			previousBasemap.set(get(currentBasemap));
			currentBasemap.set(value);
		}
	});
	currentBasemap.subscribe((value) => {
		// Updates coming from the database, or from the user swapping basemaps
		selectedBasemap.set(value);
	});

	let addOverlayLayer: { [key: string]: () => void } = {};
	function addOverlayLayerForId(id: string) {
		return () => {
			if ($map) {
				try {
					if (!$map.getSource(id)) {
						$map.addSource(id, overlays[id]);
					}
					$map.addLayer({
						id,
						type: overlays[id].type === 'raster' ? 'raster' : 'line',
						source: id,
						paint: {
							...(id in opacities
								? overlays[id].type === 'raster'
									? { 'raster-opacity': opacities[id] }
									: { 'line-opacity': opacities[id] }
								: {})
						}
					});
				} catch (e) {
					// No reliable way to check if the map is ready to add sources and layers
				}
			}
		};
	}
</script>

<CustomControl class="group min-w-[29px] min-h-[29px] overflow-hidden">
	<div
		class="flex flex-row justify-center items-center w-[29px] h-[29px] delay-100 transition-[opacity height] duration-0 group-hover:opacity-0 group-hover:h-0 group-hover:delay-0"
	>
		<Layers size="20" />
	</div>
	<div
		class="transition-[grid-template-rows grid-template-cols] grid grid-rows-[0fr] grid-cols-[0fr] duration-150 group-hover:grid-rows-[1fr] group-hover:grid-cols-[1fr] h-full"
	>
		<ScrollArea>
			<div class="h-fit">
				<div class="p-2">
					<LayerTree
						layerTree={$selectedBasemapTree}
						name="basemaps"
						bind:selected={$selectedBasemap}
					/>
				</div>
				<Separator class="w-full" />
				<div class="p-2">
					{#if $currentOverlays}
						<LayerTree
							layerTree={$selectedOverlayTree}
							name="overlays"
							multiple={true}
							bind:checked={$currentOverlays}
						/>
					{/if}
				</div>
				<Separator class="w-full" />
				<div class="p-2">
					<LayerControlSettings />
				</div>
			</div>
		</ScrollArea>
	</div>
</CustomControl>
