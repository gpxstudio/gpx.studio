<script lang="ts" context="module">
	enum CleanType {
		INSIDE = 'inside',
		OUTSIDE = 'outside'
	}
</script>

<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { Button } from '$lib/components/ui/button';
	import Help from '$lib/components/Help.svelte';
	import { _ } from 'svelte-i18n';
	import { onDestroy, onMount } from 'svelte';
	import { resetCursor, setCrosshairCursor } from '$lib/utils';
	import { Trash2 } from 'lucide-svelte';
	import { map } from '$lib/stores';
	import { selection } from '$lib/components/file-list/Selection';
	import { dbUtils } from '$lib/db';

	let cleanType = CleanType.INSIDE;
	let deleteTrackpoints = true;
	let deleteWaypoints = true;
	let rectangleCoordinates: mapboxgl.LngLat[] = [];

	function updateRectangle() {
		if ($map) {
			if (rectangleCoordinates.length != 2) {
				if ($map.getLayer('rectangle')) {
					$map.removeLayer('rectangle');
				}
			} else {
				let data = {
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[rectangleCoordinates[0].lng, rectangleCoordinates[0].lat],
								[rectangleCoordinates[1].lng, rectangleCoordinates[0].lat],
								[rectangleCoordinates[1].lng, rectangleCoordinates[1].lat],
								[rectangleCoordinates[0].lng, rectangleCoordinates[1].lat],
								[rectangleCoordinates[0].lng, rectangleCoordinates[0].lat]
							]
						]
					}
				};
				let source = $map.getSource('rectangle');
				if (source) {
					source.setData(data);
				} else {
					$map.addSource('rectangle', {
						type: 'geojson',
						data: data
					});
				}
				if (!$map.getLayer('rectangle')) {
					$map.addLayer({
						id: 'rectangle',
						type: 'fill',
						source: 'rectangle',
						paint: {
							'fill-color': 'SteelBlue',
							'fill-opacity': 0.5
						}
					});
				}
			}
		}
	}

	$: if (rectangleCoordinates) {
		updateRectangle();
	}

	let mousedown = false;
	function onMouseDown(e: any) {
		mousedown = true;
		rectangleCoordinates = [e.lngLat, e.lngLat];
	}

	function onMouseMove(e: any) {
		if (mousedown) {
			rectangleCoordinates[1] = e.lngLat;
		}
	}

	function onMouseUp(e: any) {
		mousedown = false;
	}

	onMount(() => {
		setCrosshairCursor();
	});

	$: if ($map) {
		$map.on('mousedown', onMouseDown);
		$map.on('mousemove', onMouseMove);
		$map.on('mouseup', onMouseUp);
		$map.on('touchstart', onMouseDown);
		$map.on('touchmove', onMouseMove);
		$map.on('touchend', onMouseUp);
		$map.dragPan.disable();
	}

	onDestroy(() => {
		resetCursor();
		if ($map) {
			$map.off('mousedown', onMouseDown);
			$map.off('mousemove', onMouseMove);
			$map.off('mouseup', onMouseUp);
			$map.off('touchstart', onMouseDown);
			$map.off('touchmove', onMouseMove);
			$map.off('touchend', onMouseUp);
			$map.dragPan.enable();

			if ($map.getLayer('rectangle')) {
				$map.removeLayer('rectangle');
			}
			if ($map.getSource('rectangle')) {
				$map.removeSource('rectangle');
			}
		}
	});

	$: validSelection = $selection.size > 0;
</script>

<div class="flex flex-col gap-3 w-full max-w-80 items-center {$$props.class ?? ''}">
	<fieldset class="flex flex-col gap-3">
		<div class="flex flex-row items-center gap-[6.4px] h-3">
			<Checkbox id="delete-trkpt" bind:checked={deleteTrackpoints} class="scale-90" />
			<Label for="delete-trkpt">
				{$_('toolbar.clean.delete_trackpoints')}
			</Label>
		</div>
		<div class="flex flex-row items-center gap-[6.4px] h-3">
			<Checkbox id="delete-wpt" bind:checked={deleteWaypoints} class="scale-90" />
			<Label for="delete-wpt">
				{$_('toolbar.clean.delete_waypoints')}
			</Label>
		</div>
		<RadioGroup.Root bind:value={cleanType}>
			<Label class="flex flex-row items-center gap-2">
				<RadioGroup.Item value={CleanType.INSIDE} />
				{$_('toolbar.clean.delete_inside')}
			</Label>
			<Label class="flex flex-row items-center gap-2">
				<RadioGroup.Item value={CleanType.OUTSIDE} />
				{$_('toolbar.clean.delete_outside')}
			</Label>
		</RadioGroup.Root>
	</fieldset>
	<Button
		variant="outline"
		class="w-full"
		disabled={!validSelection || rectangleCoordinates.length != 2}
		on:click={() => {
			dbUtils.cleanSelection(
				[
					{
						lat: Math.min(rectangleCoordinates[0].lat, rectangleCoordinates[1].lat),
						lon: Math.min(rectangleCoordinates[0].lng, rectangleCoordinates[1].lng)
					},
					{
						lat: Math.max(rectangleCoordinates[0].lat, rectangleCoordinates[1].lat),
						lon: Math.max(rectangleCoordinates[0].lng, rectangleCoordinates[1].lng)
					}
				],
				cleanType === CleanType.INSIDE,
				deleteTrackpoints,
				deleteWaypoints
			);
			rectangleCoordinates = [];
		}}
	>
		<Trash2 size="16" class="mr-1" />
		{$_('toolbar.clean.button')}
	</Button>
	<Help>
		{#if validSelection}
			{$_('toolbar.clean.help')}
		{:else}
			{$_('toolbar.clean.help_no_selection')}
		{/if}
	</Help>
</div>
