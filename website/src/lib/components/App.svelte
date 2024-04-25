<script lang="ts">
	import GPXMapLayers from '$lib/components/gpx-layer/GPXMapLayers.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import GPXData from '$lib/components/GPXData.svelte';
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
</script>

<div class="flex flex-col w-screen h-screen">
	<div class="grow relative">
		<Menu />
		<Toolbar />
		<Map class="h-full" />
		<LayerControl />
		<GPXMapLayers />
		<FileList />
	</div>
	<div class="h-60 flex flex-row gap-2 overflow-hidden border">
		<GPXData />
		<ElevationProfile />
	</div>
</div>
