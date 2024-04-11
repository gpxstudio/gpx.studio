<script lang="ts">
	import mapboxgl from 'mapbox-gl';
	import CustomControl from '$lib/components/custom-control/CustomControl.svelte';

	import Fa from 'svelte-fa';
	import { faLayerGroup } from '@fortawesome/free-solid-svg-icons';

	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { Checkbox } from '$lib/components/ui/checkbox';

	import { basemaps, overlays, opacities } from '$lib/assets/layers';

	export let map: mapboxgl.Map | null;

	$: if (map) {
		map?.setStyle(basemaps['mapboxOutdoors']);
	}
</script>

<CustomControl {map} class="group">
	<div class="flex flex-row justify-center items-center w-[29px] h-[29px] group-hover:hidden">
		<Fa icon={faLayerGroup} size="1.4x" />
	</div>
	<div class="hidden group-hover:block p-2">
		<RadioGroup.Root
			value="mapboxOutdoors"
			onValueChange={(id) => {
				map.setStyle(basemaps[id]);
			}}
		>
			{#each Object.keys(basemaps) as id}
				<div class="flex items-center space-x-2">
					<RadioGroup.Item value={id} {id} />
					<Label for={id}>{id}</Label>
				</div>
			{/each}
		</RadioGroup.Root>
		<div class="flex flex-col">
			{#each Object.keys(overlays) as id}
				<div>
					<Checkbox
						{id}
						onCheckedChange={(checked) => {
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
						}}
					/>
					<Label for={id}>{id}</Label>
				</div>
			{/each}
		</div>
	</div>
</CustomControl>
