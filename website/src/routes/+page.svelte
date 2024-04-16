<script lang="ts">
	import mapboxgl from 'mapbox-gl';

	import Data from '$lib/components/Data.svelte';
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';

	let map: mapboxgl.Map | null = null;
</script>

<div class="flex flex-col w-screen h-screen">
	<div class="grow relative">
		<Menu />
		<Toolbar />
		<Map class="h-full" bind:map />
		<LayerControl {map} />
		<Data {map} />
	</div>
	<div class="h-12">Test</div>
</div>
