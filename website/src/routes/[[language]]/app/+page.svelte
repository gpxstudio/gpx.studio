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
	import CoordinatesPopup from '$lib/components/CoordinatesPopup.svelte';
	import Resizer from '$lib/components/Resizer.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { observeFilesFromDatabase, settings } from '$lib/db';
	import { gpxStatistics, loadFiles, slicedGPXStatistics } from '$lib/stores';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { languages } from '$lib/languages';
	import { getURLForLanguage } from '$lib/utils';
	import { getURLForGoogleDriveFile } from '$lib/components/embedding/Embedding';
	import { _ } from 'svelte-i18n';

	const {
		treeFileView,
		elevationProfile,
		bottomPanelSize,
		rightPanelSize,
		additionalDatasets,
		elevationFill
	} = settings;

	onMount(() => {
		let files: string[] = JSON.parse($page.url.searchParams.get('files') || '[]');
		let ids: string[] = JSON.parse($page.url.searchParams.get('ids') || '[]');
		let urls: string[] = files.concat(ids.map(getURLForGoogleDriveFile));

		observeFilesFromDatabase(urls.length === 0);

		if (urls.length > 0) {
			let downloads: Promise<File | null>[] = [];
			urls.forEach((url) => {
				downloads.push(
					fetch(url)
						.then((response) => response.blob())
						.then((blob) => new File([blob], url.split('/').pop()))
				);
			});

			Promise.all(downloads).then((files) => {
				files = files.filter((file) => file !== null);
				loadFiles(files);
			});
		}
	});
</script>

<div class="fixed -z-10 text-transparent">
	<h1>{$_('metadata.home_title')} — {$_('metadata.app_title')}</h1>
	<p>{$_('metadata.description')}</p>
	<h2>{$_('toolbar.routing.tooltip')}</h2>
	<p>{$_('toolbar.routing.help_no_file')}</p>
	<p>{$_('toolbar.routing.help')}</p>
	<h3>{$_('toolbar.routing.reverse.button')}</h3>
	<p>{$_('toolbar.routing.reverse.tooltip')}</p>
	<h3>{$_('toolbar.routing.route_back_to_start.button')}</h3>
	<p>{$_('toolbar.routing.route_back_to_start.tooltip')}</p>
	<h3>{$_('toolbar.routing.round_trip.button')}</h3>
	<p>{$_('toolbar.routing.round_trip.tooltip')}</p>
	<h3>{$_('toolbar.routing.start_loop_here')}</h3>
	<h2>{$_('toolbar.scissors.tooltip')}</h2>
	<p>{$_('toolbar.scissors.help')}</p>
	<h2>{$_('toolbar.time.tooltip')}</h2>
	<p>{$_('toolbar.time.help')}</p>
	<h2>{$_('toolbar.merge.tooltip')}</h2>
	<h3>{$_('toolbar.merge.merge_traces')}</h3>
	<p>{$_('toolbar.merge.help_merge_traces')}</p>
	<h3>{$_('toolbar.merge.merge_contents')}</h3>
	<p>{$_('toolbar.merge.help_merge_contents')}</p>
	<h2>{$_('toolbar.elevation.button')}</h2>
	<p>{$_('toolbar.elevation.help')}</p>
	<h2>{$_('toolbar.waypoint.tooltip')}</h2>
	<p>{$_('toolbar.waypoint.help')}</p>
	<h2>{$_('toolbar.reduce.tooltip')}</h2>
	<p>{$_('toolbar.reduce.help')}</p>
	<h2>{$_('toolbar.clean.tooltip')}</h2>
	<p>{$_('toolbar.clean.help')}</p>
	<h2>{$_('gpx.files')}, {$_('gpx.tracks')}, {$_('gpx.segments')}, {$_('gpx.waypoints')}</h2>
</div>

<div class="fixed flex flex-row w-screen h-screen supports-dvh:h-dvh">
	<div class="flex flex-col grow h-full min-w-0">
		<div class="grow relative">
			<Menu />
			<div
				class="absolute top-0 bottom-0 left-0 z-20 flex flex-col justify-center pointer-events-none"
			>
				<Toolbar />
			</div>
			<Map class="h-full {$treeFileView ? '' : 'horizontal'}" />
			<StreetViewControl />
			<LayerControl />
			<GPXLayers />
			<CoordinatesPopup />
			<Toaster richColors />
			{#if !$treeFileView}
				<div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
					<FileList orientation="horizontal" />
				</div>
			{/if}
		</div>
		{#if $elevationProfile}
			<Resizer orientation="row" bind:after={$bottomPanelSize} minAfter={100} maxAfter={300} />
		{/if}
		<div
			class="{$elevationProfile ? '' : 'h-10'} flex flex-row gap-2 px-2 sm:px-4"
			style={$elevationProfile ? `height: ${$bottomPanelSize}px` : ''}
		>
			<GPXStatistics
				{gpxStatistics}
				{slicedGPXStatistics}
				panelSize={$bottomPanelSize}
				orientation={$elevationProfile ? 'vertical' : 'horizontal'}
			/>
			{#if $elevationProfile}
				<ElevationProfile
					{gpxStatistics}
					{slicedGPXStatistics}
					bind:additionalDatasets={$additionalDatasets}
					bind:elevationFill={$elevationFill}
				/>
			{/if}
		</div>
	</div>
	{#if $treeFileView}
		<Resizer orientation="col" bind:after={$rightPanelSize} minAfter={100} maxAfter={400} />
		<FileList orientation="vertical" recursive={true} style="width: {$rightPanelSize}px" />
	{/if}
</div>

<!-- hidden links for svelte crawling -->
<div class="hidden">
	{#each Object.entries(languages) as [lang, label]}
		<a href={getURLForLanguage(lang, '/embed')}>
			{label}
		</a>
	{/each}
</div>

<style lang="postcss">
	div :global(.toaster.group) {
		@apply absolute;
		@apply right-2;
		--offset: 50px !important;
	}
</style>
