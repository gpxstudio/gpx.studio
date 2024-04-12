<script lang="ts">
	import mapboxgl from 'mapbox-gl';

	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';
	import LayerTree from './LayerTree.svelte';

	import Label from '$lib/components/ui/label/label.svelte';
	import { Separator } from '$lib/components/ui/separator';

	import Fa from 'svelte-fa';
	import { faLayerGroup } from '@fortawesome/free-solid-svg-icons';

	import {
		basemaps,
		basemapTree,
		overlays,
		overlayTree,
		opacities,
		defaultBasemap
	} from '$lib/assets/layers';

	export let map: mapboxgl.Map | null;

	$: if (map) {
		map?.setStyle(basemaps[defaultBasemap]);
	}
</script>

<CustomControl {map} class="group">
	<div class="flex flex-row justify-center items-center w-[29px] h-[29px] group-hover:hidden">
		<Fa icon={faLayerGroup} size="1.4x" />
	</div>
	<div class="hidden group-hover:block">
		<div class="p-2">
			<Label>Basemaps</Label>
			<LayerTree
				layerTree={basemapTree}
				name="basemaps"
				onValueChange={(id) => {
					if (map) {
						map.setStyle(basemaps[id]);
					}
				}}
			/>
		</div>
		<Separator class="w-full" />
		<div class="p-2">
			<Label>Overlays</Label>
			<LayerTree
				layerTree={overlayTree}
				name="overlays"
				multiple={true}
				onValueChange={(id, checked) => {
					if (map) {
						if (checked) {
							if (!map.getSource(id)) {
								map.addSource(id, overlays[id]);
							}
							map.addLayer({
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
						} else {
							map.removeLayer(id);
						}
					}
				}}
			/>
		</div>
	</div>
</CustomControl>
