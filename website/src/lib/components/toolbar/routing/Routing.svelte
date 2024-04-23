<script lang="ts">
	import ToolbarItemMenu from '../ToolbarItemMenu.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';

	import { map, selectedFiles } from '$lib/stores';
	import { AnchorPointHierarchy, getMarker } from './routing';
	import { onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import KDBush from 'kdbush';

	import type { GPXFile } from 'gpx';

	let routingProfile = {
		value: 'bike',
		label: 'bike'
	};
	let brouterProfiles = {
		bike: 'Trekking-dry',
		racingBike: 'fastbike',
		mountainBike: 'MTB',
		foot: 'Hiking-Alpine-SAC6',
		motorcycle: 'Car-FastEco',
		water: 'river',
		railway: 'rail'
	};
	let routing = true;
	let privateRoads = false;

	let markers: mapboxgl.Marker[] = [];
	let file: GPXFile | null = null;
	let kdbush: KDBush | null = null;

	function toggleMarkersForZoomLevelAndBounds() {
		if ($map) {
			let zoom = $map.getZoom();
			markers.forEach((marker) => {
				if (marker._simplified.zoom <= zoom && $map.getBounds().contains(marker.getLngLat())) {
					marker.addTo($map);
				} else {
					marker.remove();
				}
			});
		}
	}

	function extendFile(e: mapboxgl.MapMouseEvent) {
		console.log(e.lngLat);
	}

	let insertableMarker: mapboxgl.Marker | null = null;
	function moveInsertableMarker(e: mapboxgl.MapMouseEvent) {
		if (insertableMarker && kdbush && $map) {
			let bounds = $map.getBounds();
			let latLngDistance = Math.max(
				Math.abs(bounds.getNorth() - bounds.getSouth()),
				Math.abs(bounds.getEast() - bounds.getWest())
			);
			if (kdbush.within(e.lngLat.lng, e.lngLat.lat, latLngDistance / 200).length > 0) {
				insertableMarker.setLngLat(e.lngLat);
			} else {
				insertableMarker.remove();
				insertableMarker = null;
				$map.off('mousemove', moveInsertableMarker);
			}
		}
	}
	function showInsertableMarker(e: mapboxgl.MapMouseEvent) {
		if ($map && !insertableMarker) {
			insertableMarker = getMarker({
				lon: e.lngLat.lng,
				lat: e.lngLat.lat
			});
			insertableMarker.addTo($map);
			$map.on('mousemove', moveInsertableMarker);
		}
	}

	function clean() {
		markers.forEach((marker) => {
			marker.remove();
		});
		markers = [];
		if ($map) {
			$map.off('zoom', toggleMarkersForZoomLevelAndBounds);
			$map.off('move', toggleMarkersForZoomLevelAndBounds);
			$map.off('click', extendFile);
			if (file) {
				$map.off('mouseover', file.layerId, showInsertableMarker);
			}
			if (insertableMarker) {
				insertableMarker.remove();
			}
		}
		kdbush = null;
	}

	$: if ($selectedFiles.size == 1 && $map) {
		clean();

		file = $selectedFiles.values().next().value;
		// record time
		let start = performance.now();
		let anchorPoints = AnchorPointHierarchy.create(file);
		// record time
		let end = performance.now();
		console.log('Time to create anchor points: ' + (end - start) + 'ms');

		markers = anchorPoints.getMarkers();

		toggleMarkersForZoomLevelAndBounds();
		$map.on('zoom', toggleMarkersForZoomLevelAndBounds);
		$map.on('move', toggleMarkersForZoomLevelAndBounds);
		$map.on('click', extendFile);
		$map.on('mouseover', file.layerId, showInsertableMarker);

		let points = file.getTrackPoints();

		start = performance.now();
		kdbush = new KDBush(points.length);
		for (let i = 0; i < points.length; i++) {
			kdbush.add(points[i].getLongitude(), points[i].getLatitude());
		}
		kdbush.finish();
		end = performance.now();
		console.log('Time to create kdbush: ' + (end - start) + 'ms');
	} else {
		clean();
	}

	onDestroy(() => {
		clean();
	});
</script>

<ToolbarItemMenu>
	<Card.Root>
		<Card.Header class="p-4">
			<Card.Title>Routing</Card.Title>
		</Card.Header>

		<Card.Content class="p-4 pt-0 flex flex-col gap-4">
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label>Activity</Label>
				<Select.Root bind:selected={routingProfile}>
					<Select.Trigger class="h-8 w-40">
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						{#each Object.keys(brouterProfiles) as profile}
							<Select.Item value={profile}>{profile}</Select.Item>
						{/each}
						<!-- <Select.Item value="light">Light</Select.Item>
					<Select.Item value="dark">Dark</Select.Item>
					<Select.Item value="system">System</Select.Item> -->
					</Select.Content>
				</Select.Root>
			</div>
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label for="routing">Routing (follow roads)</Label>
				<Switch id="routing" class="scale-90" bind:checked={routing} />
			</div>
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label for="private">Allow private roads</Label>
				<Switch id="private" class="scale-90" bind:checked={privateRoads} />
			</div>
			<Alert.Root class="max-w-64">
				<CircleHelp size="16" />
				<!-- <Alert.Title>Heads up!</Alert.Title> -->
				<Alert.Description>
					{#if $selectedFiles.size > 1}
						<div>Select a single file to use the routing tool</div>
					{:else if $selectedFiles.size == 0}
						<div>Select a file to use the routing tool, or create a new file from the menu</div>
					{:else}
						<div>Click on the map to plot a route</div>
					{/if}
				</Alert.Description>
			</Alert.Root>
		</Card.Content>
	</Card.Root>
</ToolbarItemMenu>
