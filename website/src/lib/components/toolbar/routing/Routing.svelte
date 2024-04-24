<script lang="ts">
	import ToolbarItemMenu from '../ToolbarItemMenu.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';

	import { map, selectedFiles } from '$lib/stores';
	import { get, type Writable } from 'svelte/store';
	import { AnchorPointHierarchy, getMarker, route } from './routing';
	import { onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import KDBush from 'kdbush';

	import type { GPXFile } from 'gpx';

	import { _ } from 'svelte-i18n';

	let brouterProfiles: { [key: string]: string } = {
		bike: 'Trekking-dry',
		racing_bike: 'fastbike',
		mountain_bike: 'MTB',
		foot: 'Hiking-Alpine-SAC6',
		motorcycle: 'Car-FastEco',
		water: 'river',
		railway: 'rail'
	};
	let routingProfile = {
		value: 'bike',
		label: $_('toolbar.routing.activities.bike')
	};
	let routing = true;
	let privateRoads = false;

	let anchorPointHierarchy: AnchorPointHierarchy | null = null;
	let markers: mapboxgl.Marker[] = [];
	let file: Writable<GPXFile> | null = null;
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

	async function extendFile(e: mapboxgl.MapMouseEvent) {
		if (file && anchorPointHierarchy && anchorPointHierarchy.points.length > 0) {
			let lastPoint = anchorPointHierarchy.points[anchorPointHierarchy.points.length - 1];
			let newPoint = {
				lon: e.lngLat.lng,
				lat: e.lngLat.lat
			};
			let response = await route(
				[lastPoint.point.getCoordinates(), newPoint],
				brouterProfiles[routingProfile.value],
				privateRoads,
				routing
			);
			console.log(response);
			file.update((file) => {
				file.append(response);
				return file;
			});
		}
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
				$map.off('mouseover', get(file).layerId, showInsertableMarker);
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
		anchorPointHierarchy = AnchorPointHierarchy.create(get(file));
		// record time
		let end = performance.now();
		console.log('Time to create anchor points: ' + (end - start) + 'ms');

		markers = anchorPointHierarchy.getMarkers();

		toggleMarkersForZoomLevelAndBounds();
		$map.on('zoom', toggleMarkersForZoomLevelAndBounds);
		$map.on('move', toggleMarkersForZoomLevelAndBounds);
		$map.on('click', extendFile);
		$map.on('mouseover', get(file).layerId, showInsertableMarker);

		let points = get(file).getTrackPoints();

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
		<Card.Content class="p-4 flex flex-col gap-4">
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label>{$_('toolbar.routing.activity')}</Label>
				<Select.Root bind:selected={routingProfile}>
					<Select.Trigger class="h-8 w-40">
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						{#each Object.keys(brouterProfiles) as profile}
							<Select.Item value={profile}
								>{$_(`toolbar.routing.activities.${profile}`)}</Select.Item
							>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label for="routing">{$_('toolbar.routing.use_routing')}</Label>
				<Switch id="routing" class="scale-90" bind:checked={routing} />
			</div>
			<div class="w-full flex flex-row justify-between items-center gap-2">
				<Label for="private">{$_('toolbar.routing.allow_private')}</Label>
				<Switch id="private" class="scale-90" bind:checked={privateRoads} />
			</div>
			<Alert.Root class="max-w-64">
				<CircleHelp size="16" />
				<!-- <Alert.Title>Heads up!</Alert.Title> -->
				<Alert.Description>
					{#if $selectedFiles.size > 1}
						<div>{$_('toolbar.routing.help_multiple_files')}</div>
					{:else if $selectedFiles.size == 0}
						<div>{$_('toolbar.routing.help_no_file')}</div>
					{:else}
						<div>{$_('toolbar.routing.help')}</div>
					{/if}
				</Alert.Description>
			</Alert.Root>
		</Card.Content>
	</Card.Root>
</ToolbarItemMenu>
