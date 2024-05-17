<script lang="ts">
	import GPXLayers from '$lib/components/gpx-layer/GPXLayers.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import GPXStatistics from '$lib/components/GPXStatistics.svelte';
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import FileList2 from './file-list/FileList2.svelte';
</script>

<div class="flex flex-row w-screen h-screen">
	<div class="flex flex-col grow h-full min-w-0">
		<div class="grow relative">
			<Menu />
			<Toolbar />
			<Map class="h-full" />
			<LayerControl />
			<GPXLayers />
			<Toaster richColors />
		</div>
		<div class="h-48 flex flex-row gap-2 overflow-hidden">
			<GPXStatistics />
			<ElevationProfile />
		</div>
	</div>
	<FileList2 />
</div>

<style lang="postcss">
	div :global(.toaster.group) {
		@apply absolute;
		@apply right-2;
		--offset: 50px !important;
	}
</style>
