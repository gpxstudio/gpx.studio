<script lang="ts">
	import GPXLayers from '$lib/components/gpx-layer/GPXLayers.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import FileList from '$lib/components/file-list/FileList.svelte';
	import GPXStatistics from '$lib/components/GPXStatistics.svelte';
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
	import { Toaster } from '$lib/components/ui/sonner';

	import { settings } from '$lib/db';

	const { verticalFileView, elevationProfile } = settings;
</script>

<div class="fixed flex flex-row w-screen h-screen">
	<div class="flex flex-col grow h-full min-w-0">
		<div class="grow relative">
			<Menu />
			<Toolbar />
			<Map class="h-full {$verticalFileView ? '' : 'horizontal'}" />
			<LayerControl />
			<GPXLayers />
			<Toaster richColors />
			{#if !$verticalFileView}
				<div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
					<FileList orientation="horizontal" />
				</div>
			{/if}
		</div>
		<div class="{$elevationProfile ? 'h-48' : 'h-10'} flex flex-row gap-2 overflow-hidden">
			<GPXStatistics />
			{#if $elevationProfile}
				<ElevationProfile />
			{/if}
		</div>
	</div>
	{#if $verticalFileView}
		<FileList orientation="vertical" recursive={true} class="w-60" />
	{/if}
</div>

<style lang="postcss">
	div :global(.toaster.group) {
		@apply absolute;
		@apply right-2;
		--offset: 50px !important;
	}
</style>
