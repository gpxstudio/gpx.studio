<script lang="ts">
	import ToolbarItemMenu from '../ToolbarItemMenu.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';

	import { map, selectedFiles } from '$lib/stores';
	import { AnchorPointHierarchy } from './routing';
	import { onDestroy } from 'svelte';

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

	function addMarkersForZoomLevel() {
		if ($map) {
			let zoom = $map.getZoom();
			markers.forEach((marker) => {
				if (marker._hierarchy.lowestLevel <= zoom) {
					marker.removeClassName('hidden');
				} else {
					marker.addClassName('hidden');
				}
			});
		}
	}

	function clean() {
		markers.forEach((marker) => {
			marker.remove();
		});
		markers = [];
		if ($map) {
			$map.off('zoom', addMarkersForZoomLevel);
		}
	}

	$: if ($selectedFiles.size == 1 && $map) {
		let file = $selectedFiles.values().next().value;
		let anchorPoints = AnchorPointHierarchy.create(file);
		markers = anchorPoints.getMarkers($map);

		addMarkersForZoomLevel();
		$map.on('zoom', addMarkersForZoomLevel);
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
