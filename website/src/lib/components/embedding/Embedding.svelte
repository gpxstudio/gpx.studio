<script lang="ts">
	import GPXLayers from '$lib/components/gpx-layer/GPXLayers.svelte';
	import ElevationProfile from '$lib/components/ElevationProfile.svelte';
	import FileList from '$lib/components/file-list/FileList.svelte';
	import GPXStatistics from '$lib/components/GPXStatistics.svelte';
	import MapComponent from '$lib/components/Map.svelte';
	import LayerControl from '$lib/components/layer-control/LayerControl.svelte';
	import OpenIn from '$lib/components/embedding/OpenIn.svelte';

	import { gpxStatistics, slicedGPXStatistics, embedding, loadFile, map } from '$lib/stores';
	import { onDestroy, onMount } from 'svelte';
	import { fileObservers, settings, GPXStatisticsTree } from '$lib/db';
	import { readable } from 'svelte/store';
	import type { GPXFile } from 'gpx';
	import { selection } from '$lib/components/file-list/Selection';
	import { ListFileItem } from '$lib/components/file-list/FileList';
	import { allowedEmbeddingBasemaps, type EmbeddingOptions } from './Embedding';

	$embedding = true;

	const { currentBasemap, distanceUnits, velocityUnits, temperatureUnits } = settings;

	export let options: EmbeddingOptions;

	let prevUnits = {
		distance: '',
		velocity: '',
		temperature: ''
	};

	function applyOptions() {
		fileObservers.update(($fileObservers) => {
			$fileObservers.clear();
			return $fileObservers;
		});

		let downloads: Promise<GPXFile | null>[] = [];
		options.files.forEach((url) => {
			downloads.push(
				fetch(url)
					.then((response) => response.blob())
					.then((blob) => new File([blob], url.split('/').pop() ?? url))
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

			fileObservers.update(($fileObservers) => {
				files.forEach((file, index) => {
					if (file === null) {
						return;
					}

					let id = `gpx-${index}`;
					file._data.id = id;
					let statistics = new GPXStatisticsTree(file);

					$fileObservers.set(
						id,
						readable({
							file,
							statistics
						})
					);

					ids.push(id);
					let fileBounds = statistics.getStatisticsFor(new ListFileItem(id)).global.bounds;

					bounds.southWest.lat = Math.min(bounds.southWest.lat, fileBounds.southWest.lat);
					bounds.southWest.lon = Math.min(bounds.southWest.lon, fileBounds.southWest.lon);
					bounds.northEast.lat = Math.max(bounds.northEast.lat, fileBounds.northEast.lat);
					bounds.northEast.lon = Math.max(bounds.northEast.lon, fileBounds.northEast.lon);
				});

				return $fileObservers;
			});

			selection.update(($selection) => {
				$selection.clear();
				ids.forEach((id) => {
					$selection.toggle(new ListFileItem(id));
				});
				return $selection;
			});

			console.log($fileObservers, $selection);

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
		});

		if (options.basemap !== $currentBasemap && allowedEmbeddingBasemaps.includes(options.basemap)) {
			$currentBasemap = options.basemap;
		}

		if (options.distanceUnits !== $distanceUnits) {
			$distanceUnits = options.distanceUnits;
		}

		if (options.velocityUnits !== $velocityUnits) {
			$velocityUnits = options.velocityUnits;
		}

		if (options.temperatureUnits !== $temperatureUnits) {
			$temperatureUnits = options.temperatureUnits;
		}
	}

	onMount(() => {
		prevUnits.distance = $distanceUnits;
		prevUnits.velocity = $velocityUnits;
		prevUnits.temperature = $temperatureUnits;
	});

	$: if (options) {
		applyOptions();
	}

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

<div class="absolute flex flex-col h-full w-full border rounded-xl overflow-clip">
	<div class="grow relative">
		<MapComponent
			class="h-full {$fileObservers.size > 1 ? 'horizontal' : ''}"
			accessToken={options.token}
			geocoder={false}
		/>
		<OpenIn bind:files={options.files} />
		<LayerControl />
		<GPXLayers />
		{#if $fileObservers.size > 1}
			<div class="h-10 -translate-y-10 w-full pointer-events-none absolute z-30">
				<FileList orientation="horizontal" />
			</div>
		{/if}
	</div>
	<div
		class="{options.elevation.show ? '' : 'h-10'} flex flex-row gap-2 px-2 sm:px-4"
		style={options.elevation.show ? `height: ${options.elevation.height}px` : ''}
	>
		<GPXStatistics
			{gpxStatistics}
			{slicedGPXStatistics}
			panelSize={options.elevation.height}
			orientation={options.elevation.show ? 'vertical' : 'horizontal'}
		/>
		{#if options.elevation.show}
			<ElevationProfile
				{gpxStatistics}
				{slicedGPXStatistics}
				additionalDatasets={[
					options.elevation.speed ? 'speed' : null,
					options.elevation.hr ? 'hr' : null,
					options.elevation.cad ? 'cad' : null,
					options.elevation.temp ? 'temp' : null,
					options.elevation.power ? 'power' : null
				].filter((dataset) => dataset !== null)}
				elevationFill={options.elevation.fill}
				panelSize={options.elevation.height}
				showControls={options.elevation.controls}
				class="py-2"
			/>
		{/if}
	</div>
</div>
