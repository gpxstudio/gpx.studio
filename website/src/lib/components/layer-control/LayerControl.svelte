<script lang="ts">
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import LayerTree from './LayerTree.svelte';

	import { Separator } from '$lib/components/ui/separator';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';

	import { Layers } from 'lucide-svelte';

	import { basemaps, defaultBasemap, overlays } from '$lib/assets/layers';
	import { settings } from '$lib/db';
	import { map } from '$lib/stores';
	import { get, writable } from 'svelte/store';
	import { customBasemapUpdate, getLayers } from './utils';
	import { OverpassLayer } from './OverpassLayer';
	import OverpassPopup from './OverpassPopup.svelte';

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

	function setStyle() {
		if ($map) {
			let basemap = basemaps.hasOwnProperty($currentBasemap)
				? basemaps[$currentBasemap]
				: $customLayers[$currentBasemap]?.value ?? basemaps[defaultBasemap];
			$map.removeImport('basemap');
			if (typeof basemap === 'string') {
				$map.addImport({ id: 'basemap', url: basemap }, 'overlays');
			} else {
				$map.addImport(
					{
						id: 'basemap',
						data: basemap
					},
					'overlays'
				);
			}
		}
	}

	$: if ($map && ($currentBasemap || $customBasemapUpdate)) {
		setStyle();
	}

	function addOverlay(id: string) {
		try {
			let overlay = $customLayers.hasOwnProperty(id) ? $customLayers[id].value : overlays[id];
			if (typeof overlay === 'string') {
				$map.addImport({ id, url: overlay });
			} else {
				if ($opacities.hasOwnProperty(id)) {
					overlay = {
						...overlay,
						layers: overlay.layers.map((layer) => {
							if (layer.type === 'raster') {
								if (!layer.paint) {
									layer.paint = {};
								}
								layer.paint['raster-opacity'] = $opacities[id];
							}
							return layer;
						})
					};
				}
				$map.addImport({
					id,
					data: overlay
				});
			}
		} catch (e) {
			// No reliable way to check if the map is ready to add sources and layers
		}
	}

	function updateOverlays() {
		if ($map && $currentOverlays) {
			let overlayLayers = getLayers($currentOverlays);
			try {
				let activeOverlays = $map
					.getStyle()
					.imports.filter((i) => i.id !== 'basemap' && i.id !== 'overlays');
				let toRemove = activeOverlays.filter((i) => !overlayLayers[i.id]);
				toRemove.forEach((i) => {
					$map.removeImport(i.id);
				});
				let toAdd = Object.entries(overlayLayers)
					.filter(([id, selected]) => selected && !activeOverlays.some((j) => j.id === id))
					.map(([id]) => id);
				toAdd.forEach((id) => {
					addOverlay(id);
				});
			} catch (e) {
				// No reliable way to check if the map is ready to add sources and layers
			}
		}
	}

	$: if ($map && $currentOverlays) {
		updateOverlays();
	}

	$: if ($map) {
		if (overpassLayer) {
			overpassLayer.remove();
		}
		overpassLayer = new OverpassLayer($map);
		overpassLayer.add();
		$map.on('style.import.load', updateOverlays);
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

	function removeOverlayLayer(id: string) {
		if ($map) {
			let overlay = $customLayers.hasOwnProperty(id) ? $customLayers[id].value : overlays[id];
			if (overlay.layers) {
				$map.removeImport(id);
			} else {
				$map.removeLayer(id);
			}
		}
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

<OverpassPopup />

<svelte:window
	on:click={(e) => {
		if (open && !cancelEvents && !container.contains(e.target)) {
			closeLayerControl();
		}
	}}
/>
