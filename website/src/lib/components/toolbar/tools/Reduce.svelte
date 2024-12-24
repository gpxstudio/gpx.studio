<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import { selection } from '$lib/components/file-list/Selection';
	import { ListItem, ListRootItem, ListTrackSegmentItem } from '$lib/components/file-list/FileList';
	import Help from '$lib/components/Help.svelte';
	import { Filter } from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';
	import WithUnits from '$lib/components/WithUnits.svelte';
	import { dbUtils, fileObservers } from '$lib/db';
	import { map } from '$lib/stores';
	import { onDestroy } from 'svelte';
	import { ramerDouglasPeucker, TrackPoint, type SimplifiedTrackPoint } from 'gpx';
	import { derived } from 'svelte/store';
	import { getURLForLanguage } from '$lib/utils';

	let sliderValue = [50];
	let maxPoints = 0;
	let currentPoints = 0;
	const minTolerance = 0.1;
	const maxTolerance = 10000;

	$: validSelection = $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints']);

	$: tolerance =
		minTolerance * 2 ** (sliderValue[0] / (100 / Math.log2(maxTolerance / minTolerance)));

	let simplified = new Map<string, [ListItem, number, SimplifiedTrackPoint[]]>();
	let unsubscribes = new Map<string, () => void>();

	function update() {
		maxPoints = 0;
		currentPoints = 0;

		let data: GeoJSON.FeatureCollection = {
			type: 'FeatureCollection',
			features: []
		};

		simplified.forEach(([item, maxPts, points], itemFullId) => {
			maxPoints += maxPts;

			let current = points.filter(
				(point) => point.distance === undefined || point.distance >= tolerance
			);
			currentPoints += current.length;

			data.features.push({
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates: current.map((point) => [
						point.point.getLongitude(),
						point.point.getLatitude()
					])
				},
				properties: {}
			});
		});

		if ($map) {
			let source = $map.getSource('simplified');
			if (source) {
				source.setData(data);
			} else {
				$map.addSource('simplified', {
					type: 'geojson',
					data: data
				});
			}
			if (!$map.getLayer('simplified')) {
				$map.addLayer({
					id: 'simplified',
					type: 'line',
					source: 'simplified',
					paint: {
						'line-color': 'white',
						'line-width': 3
					}
				});
			} else {
				$map.moveLayer('simplified');
			}
		}
	}

	$: if ($fileObservers) {
		unsubscribes.forEach((unsubscribe, fileId) => {
			if (!$fileObservers.has(fileId)) {
				unsubscribe();
				unsubscribes.delete(fileId);
			}
		});
		$fileObservers.forEach((fileStore, fileId) => {
			if (!unsubscribes.has(fileId)) {
				let unsubscribe = derived([fileStore, selection], ([fs, sel]) => [fs, sel]).subscribe(
					([fs, sel]) => {
						if (fs) {
							fs.file.forEachSegment((segment, trackIndex, segmentIndex) => {
								let segmentItem = new ListTrackSegmentItem(fileId, trackIndex, segmentIndex);
								if (sel.hasAnyParent(segmentItem)) {
									let statistics = fs.statistics.getStatisticsFor(segmentItem);
									simplified.set(segmentItem.getFullId(), [
										segmentItem,
										statistics.local.points.length,
										ramerDouglasPeucker(statistics.local.points, minTolerance)
									]);
									update();
								} else if (simplified.has(segmentItem.getFullId())) {
									simplified.delete(segmentItem.getFullId());
									update();
								}
							});
						}
					}
				);
				unsubscribes.set(fileId, unsubscribe);
			}
		});
	}

	$: if (tolerance) {
		update();
	}

	onDestroy(() => {
		if ($map) {
			if ($map.getLayer('simplified')) {
				$map.removeLayer('simplified');
			}
			if ($map.getSource('simplified')) {
				$map.removeSource('simplified');
			}
		}
		unsubscribes.forEach((unsubscribe) => unsubscribe());
		simplified.clear();
	});

	function reduce() {
		let itemsAndPoints = new Map<ListItem, TrackPoint[]>();
		simplified.forEach(([item, maxPts, points], itemFullId) => {
			itemsAndPoints.set(
				item,
				points
					.filter((point) => point.distance === undefined || point.distance >= tolerance)
					.map((point) => point.point)
			);
		});
		dbUtils.reduce(itemsAndPoints);
	}
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {$$props.class ?? ''}">
	<div class="p-2">
		<Slider bind:value={sliderValue} min={0} max={100} step={1} />
	</div>
	<Label class="flex flex-row justify-between">
		<span>{$_('toolbar.reduce.tolerance')}</span>
		<WithUnits value={tolerance / 1000} type="distance" decimals={4} class="font-normal" />
	</Label>
	<Label class="flex flex-row justify-between">
		<span>{$_('toolbar.reduce.number_of_points')}</span>
		<span class="font-normal">{currentPoints}/{maxPoints}</span>
	</Label>
	<Button variant="outline" disabled={!validSelection} on:click={reduce}>
		<Filter size="16" class="mr-1" />
		{$_('toolbar.reduce.button')}
	</Button>

	<Help link={getURLForLanguage($locale, '/help/toolbar/minify')}>
		{#if validSelection}
			{$_('toolbar.reduce.help')}
		{:else}
			{$_('toolbar.reduce.help_no_selection')}
		{/if}
	</Help>
</div>
