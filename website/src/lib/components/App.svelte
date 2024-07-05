<script lang="ts">
	import GPXLayers from '$lib/components/gpx-layer/GPXLayers.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import FileList from '$lib/components/file-list/FileList.svelte';
	import GPXStatistics from '$lib/components/GPXStatistics.svelte';
	import Map from '$lib/components/Map.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Toolbar from '$lib/components/toolbar/Toolbar.svelte';
	import StreetViewControl from '$lib/components/street-view-control/StreetViewControl.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
	import Resizer from '$lib/components/Resizer.svelte';
	import { Toaster } from '$lib/components/ui/sonner';

	import { settings } from '$lib/db';
	import { gpxStatistics, slicedGPXStatistics } from '$lib/stores';

	const {
		verticalFileView,
		elevationProfile,
		bottomPanelSize,
		rightPanelSize,
		distanceUnits,
		velocityUnits,
		temperatureUnits,
		additionalDatasets,
		elevationFill
	} = settings;
</script>

<div class="fixed flex flex-row w-screen h-screen h-dvh">
	<div class="flex flex-col grow h-full min-w-0">
		<div class="grow relative">
			<Menu />
			<div
				class="absolute top-0 bottom-0 left-0 z-20 flex flex-col justify-center pointer-events-none"
			>
				<Toolbar />
			</div>
			<Map class="h-full {$verticalFileView ? '' : 'horizontal'}" />
			<StreetViewControl />
			<LayerControl />
			<GPXLayers />
			<Toaster richColors />
			{#if !$verticalFileView}
				<div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
					<FileList orientation="horizontal" />
				</div>
			{/if}
		</div>
		{#if $elevationProfile}
			<Resizer orientation="row" bind:after={$bottomPanelSize} minAfter={100} maxAfter={300} />
		{/if}
		<div
			class="{$elevationProfile ? '' : 'h-10'} flex flex-row gap-2"
			style={$elevationProfile ? `height: ${$bottomPanelSize}px` : ''}
		>
			<GPXStatistics
				{gpxStatistics}
				{slicedGPXStatistics}
				panelSize={$bottomPanelSize}
				orientation={$elevationProfile ? 'vertical' : 'horizontal'}
				velocityUnits={$velocityUnits}
			/>
			{#if $elevationProfile}
				<ElevationProfile
					{gpxStatistics}
					{slicedGPXStatistics}
					bind:additionalDatasets={$additionalDatasets}
					bind:elevationFill={$elevationFill}
					panelSize={$bottomPanelSize}
					distanceUnits={$distanceUnits}
					velocityUnits={$velocityUnits}
					temperatureUnits={$temperatureUnits}
					class="py-2 pr-4"
				/>
			{/if}
		</div>
	</div>
	{#if $verticalFileView}
		<Resizer orientation="col" bind:after={$rightPanelSize} minAfter={100} maxAfter={400} />
		<FileList orientation="vertical" recursive={true} style="width: {$rightPanelSize}px" />
	{/if}
</div>

<style lang="postcss">
	div :global(.toaster.group) {
		@apply absolute;
		@apply right-2;
		--offset: 50px !important;
	}
</style>
