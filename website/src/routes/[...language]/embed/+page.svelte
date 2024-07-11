<script lang="ts">
	import GPXLayers from '$lib/components/gpx-layer/GPXLayers.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import FileList from '$lib/components/file-list/FileList.svelte';
	import GPXStatistics from '$lib/components/GPXStatistics.svelte';
	import MapComponent from '$lib/components/Map.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
	import OpenIn from '$lib/components/OpenIn.svelte';

	import { gpxStatistics, slicedGPXStatistics, embedding, loadFile, map } from '$lib/stores';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import { fileObservers, settings, GPXStatisticsTree } from '$lib/db';
	import { readable } from 'svelte/store';
	import type { GPXFile } from 'gpx';
	import { selection } from '$lib/components/file-list/Selection';
	import { ListFileItem } from '$lib/components/file-list/FileList';

	$embedding = true;

	const { currentBasemap, distanceUnits, velocityUnits, temperatureUnits } = settings;

	let elevationProfile = true;
	let bottomPanelSize = 170;
	let additionalDatasets: string[] = [];
	let elevationFill: 'slope' | 'surface' | undefined = undefined;
	let elevationControls = true;

	let files: string[] = [];

	let prevUnits = {
		distance: '',
		velocity: '',
		temperature: ''
	};

	onMount(() => {
		let options = $page.url.searchParams.get('options');
		if (options === null) {
			return;
		}
		options = JSON.parse(options);
		if (options === null) {
			return;
		}

		if (options.files && Array.isArray(options.files)) {
			files = options.files;
			let downloads: Promise<GPXFile | null>[] = [];
			options.files.forEach((url) => {
				downloads.push(
					fetch(url)
						.then((response) => response.blob())
						.then((blob) => new File([blob], url.split('/').pop()))
						.then(loadFile)
				);
			});

			Promise.all(downloads).then((files) => {
				let ids: string[] = [];
				let bounds = {
					southWest: {
						lat: 90,
						lon: 180
					},
					northEast: {
						lat: -90,
						lon: -180
					}
				};

				files.forEach((file, index) => {
					if (file === null) {
						return;
					}

					let id = `gpx-${index}`;
					file._data.id = id;
					let statistics = new GPXStatisticsTree(file);

					fileObservers.update(($fileObservers) => {
						$fileObservers.set(
							id,
							readable({
								file,
								statistics
							})
						);
						return $fileObservers;
					});

					ids.push(id);
					let fileBounds = statistics.getStatisticsFor(new ListFileItem(id)).global.bounds;

					bounds.southWest.lat = Math.min(bounds.southWest.lat, fileBounds.southWest.lat);
					bounds.southWest.lon = Math.min(bounds.southWest.lon, fileBounds.southWest.lon);
					bounds.northEast.lat = Math.max(bounds.northEast.lat, fileBounds.northEast.lat);
					bounds.northEast.lon = Math.max(bounds.northEast.lon, fileBounds.northEast.lon);
				});

				selection.update(($selection) => {
					$selection.clear();
					ids.forEach((id) => {
						$selection.toggle(new ListFileItem(id));
					});
					return $selection;
				});

				if ($page.url.hash.length === 0) {
					map.subscribe(($map) => {
						if ($map) {
							$map.fitBounds(
								[
									bounds.southWest.lon,
									bounds.southWest.lat,
									bounds.northEast.lon,
									bounds.northEast.lat
								],
								{
									padding: 80,
									linear: true,
									easing: () => 1
								}
							);
						}
					});
				}
			});
		}

		if (options.basemap !== undefined && typeof options.basemap === 'string') {
			currentBasemap.set(options.basemap);
		}

		if (options.elevation !== undefined && typeof options.elevation === 'object') {
			const elevationOptions = options.elevation;
			if (elevationOptions.show !== undefined && typeof elevationOptions.show === 'boolean') {
				elevationProfile = elevationOptions.show;
			}

			if (elevationOptions.data && Array.isArray(elevationOptions.data)) {
				elevationOptions.data.forEach((dataset) => {
					if (['speed', 'hr', 'cad', 'temp', 'power'].includes(dataset)) {
						additionalDatasets.push(dataset);
					}
				});
			}

			if (elevationOptions.fill === 'slope' || elevationOptions.fill === 'surface') {
				elevationFill = elevationOptions.fill;
			}

			if (elevationOptions.height !== undefined && typeof elevationOptions.height === 'number') {
				bottomPanelSize = elevationOptions.height;
			}

			if (
				elevationOptions.controls !== undefined &&
				typeof elevationOptions.controls === 'boolean'
			) {
				elevationControls = elevationOptions.controls;
			}
		}

		prevUnits.distance = $distanceUnits;
		prevUnits.velocity = $velocityUnits;
		prevUnits.temperature = $temperatureUnits;

		if (options.distanceUnits === 'metric' || options.distanceUnits === 'imperial') {
			$distanceUnits = options.distanceUnits;
		}

		if (options.velocityUnits === 'speed' || options.velocityUnits === 'pace') {
			$velocityUnits = options.velocityUnits;
		}

		if (options.temperatureUnits === 'celsius' || options.temperatureUnits === 'fahrenheit') {
			$temperatureUnits = options.temperatureUnits;
		}
	});

	onDestroy(() => {
		if ($distanceUnits !== prevUnits.distance) {
			$distanceUnits = prevUnits.distance;
		}

		if ($velocityUnits !== prevUnits.velocity) {
			$velocityUnits = prevUnits.velocity;
		}

		if ($temperatureUnits !== prevUnits.temperature) {
			$temperatureUnits = prevUnits.temperature;
		}
	});
</script>

<div class="fixed flex flex-col h-full w-full border rounded-xl overflow-clip">
	<div class="grow relative">
		<MapComponent class="h-full {$fileObservers.size > 1 ? 'horizontal' : ''}" geocoder={false} />
		<OpenIn bind:files />
		<LayerControl />
		<GPXLayers />
		{#if $fileObservers.size > 1}
			<div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
				<FileList orientation="horizontal" />
			</div>
		{/if}
	</div>
	<div
		class="{elevationProfile ? '' : 'h-10'} flex flex-row gap-2 px-2 sm:px-4"
		style={elevationProfile ? `height: ${bottomPanelSize}px` : ''}
	>
		<GPXStatistics
			{gpxStatistics}
			{slicedGPXStatistics}
			panelSize={bottomPanelSize}
			orientation={elevationProfile ? 'vertical' : 'horizontal'}
		/>
		{#if elevationProfile}
			<ElevationProfile
				{gpxStatistics}
				{slicedGPXStatistics}
				{additionalDatasets}
				{elevationFill}
				panelSize={bottomPanelSize}
				showControls={elevationControls}
				class="py-2"
			/>
		{/if}
	</div>
</div>
