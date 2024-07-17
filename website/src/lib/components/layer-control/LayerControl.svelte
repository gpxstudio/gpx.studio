<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import LayerTree from './LayerTree.svelte';

	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import { Layers } from 'lucide-svelte';

	import { basemaps, overlays } from '$lib/assets/layers';
	import { settings } from '$lib/db';
	import { map } from '$lib/stores';
	import { get, writable } from 'svelte/store';
	import { getLayers } from './utils';
	import { OverpassLayer } from './OverpassLayer';

	let container: HTMLDivElement;
	let overpassLayer: OverpassLayer;

	const {
		currentBasemap,
		previousBasemap,
		currentOverlays,
		currentOverpassQueries,
		selectedBasemapTree,
		selectedOverlayTree,
		selectedOverpassTree,
		customLayers,
		opacities
	} = settings;

	$: if ($map) {
		// Set style depending on the current basemap
		let basemap = basemaps.hasOwnProperty($currentBasemap)
			? basemaps[$currentBasemap]
			: $customLayers[$currentBasemap].value;
		$map.setStyle(basemap, {
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

	$: if ($map) {
		if (overpassLayer) {
			overpassLayer.remove();
		}
		overpassLayer = new OverpassLayer($map);
		overpassLayer.add();
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
					let overlay = $customLayers.hasOwnProperty(id) ? $customLayers[id].value : overlays[id];
					if (!$map.getSource(id)) {
						$map.addSource(id, overlay);
					}
					$map.addLayer(
						{
							id,
							type: overlay.type === 'raster' ? 'raster' : 'line',
							source: id,
							paint: {
								...(id in $opacities
									? overlay.type === 'raster'
										? { 'raster-opacity': $opacities[id] }
										: { 'line-opacity': $opacities[id] }
									: {})
							}
						},
						'overlays'
					);
				} catch (e) {
					// No reliable way to check if the map is ready to add sources and layers
				}
			}
		};
	}

	let open = false;
	function openLayerControl() {
		open = true;
	}
	function closeLayerControl() {
		open = false;
	}
	let cancelEvents = false;
</script>

<CustomControl class="group min-w-[29px] min-h-[29px] overflow-hidden">
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		bind:this={container}
		class="h-full w-full"
		on:mouseenter={openLayerControl}
		on:mouseleave={closeLayerControl}
		on:pointerenter={() => {
			if (!open) {
				cancelEvents = true;
				openLayerControl();
				setTimeout(() => {
					cancelEvents = false;
				}, 500);
			}
		}}
	>
		<div
			class="flex flex-row justify-center items-center delay-100 transition-[opacity] duration-0 {open
				? 'opacity-0 w-0 h-0 delay-0'
				: 'w-[29px] h-[29px]'}"
		>
			<Layers size="20" />
		</div>
		<div
			class="transition-[grid-template-rows grid-template-cols] grid grid-rows-[0fr] grid-cols-[0fr] duration-150 h-full {open
				? 'grid-rows-[1fr] grid-cols-[1fr]'
				: ''} {cancelEvents ? 'pointer-events-none' : ''}"
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
						{#if $currentOverpassQueries}
							<LayerTree
								layerTree={$selectedOverpassTree}
								name="overpass"
								multiple={true}
								bind:checked={$currentOverpassQueries}
							/>
						{/if}
					</div>
				</div>
			</ScrollArea>
		</div>
	</div>
</CustomControl>

<svelte:window
	on:click={(e) => {
		if (open && !cancelEvents && !container.contains(e.target)) {
			closeLayerControl();
		}
	}}
/>
