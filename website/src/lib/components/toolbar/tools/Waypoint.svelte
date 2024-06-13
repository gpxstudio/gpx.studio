<script lang="ts" context="module">
	import { writable } from 'svelte/store';

	export const selectedWaypoint = writable<[Waypoint, string] | undefined>(undefined);
</script>

<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button';
	import { selection } from '$lib/components/file-list/Selection';
	import { Waypoint } from 'gpx';
	import { _ } from 'svelte-i18n';
	import { ListWaypointItem } from '$lib/components/file-list/FileList';
	import { dbUtils, fileObservers, settings, type GPXFileWithStatistics } from '$lib/db';
	import { get } from 'svelte/store';
	import Help from '$lib/components/Help.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { map } from '$lib/stores';
	import { resetCursor, setCrosshairCursor } from '$lib/utils';
	import { CirclePlus, CircleX, RefreshCw } from 'lucide-svelte';

	let name: string;
	let description: string;
	let comment: string;
	let longitude: number;
	let latitude: number;

	const { verticalFileView } = settings;

	$: canCreate = $selection.size > 0;

	$: if ($verticalFileView && $selection) {
		selectedWaypoint.update(() => {
			if ($selection.size === 1) {
				let item = $selection.getSelected()[0];
				if (item instanceof ListWaypointItem) {
					let fileStore = get(fileObservers).get(item.getFileId());
					if (fileStore) {
						let waypoint = get(fileStore)?.file.wpt[item.getWaypointIndex()];
						if (waypoint) {
							return [waypoint, item.getFileId()];
						}
					}
				}
			}
			return undefined;
		});
	}

	let unsubscribe: (() => void) | undefined = undefined;
	function updateWaypointData(fileStore: GPXFileWithStatistics | undefined) {
		if ($selectedWaypoint) {
			if (fileStore) {
				if ($selectedWaypoint[0]._data.index < fileStore.file.wpt.length) {
					$selectedWaypoint[0] = fileStore.file.wpt[$selectedWaypoint[0]._data.index];
					name = $selectedWaypoint[0].name ?? '';
					description = $selectedWaypoint[0].desc ?? '';
					comment = $selectedWaypoint[0].cmt ?? '';
					longitude = $selectedWaypoint[0].getLongitude();
					latitude = $selectedWaypoint[0].getLatitude();
				} else {
					selectedWaypoint.set(undefined);
				}
			} else {
				selectedWaypoint.set(undefined);
			}
		}
	}

	function resetWaypointData() {
		name = '';
		description = '';
		comment = '';
		longitude = 0;
		latitude = 0;
	}

	$: {
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = undefined;
		}
		if ($selectedWaypoint) {
			let fileStore = get(fileObservers).get($selectedWaypoint[1]);
			if (fileStore) {
				unsubscribe = fileStore.subscribe(updateWaypointData);
			}
		} else {
			resetWaypointData();
		}
	}

	function createOrUpdateWaypoint() {
		if (typeof latitude === 'string') {
			latitude = parseFloat(latitude);
		}
		if (typeof longitude === 'string') {
			longitude = parseFloat(longitude);
		}
		latitude = parseFloat(latitude.toFixed(6));
		longitude = parseFloat(longitude.toFixed(6));
		if ($selectedWaypoint) {
			dbUtils.applyToFile($selectedWaypoint[1], (file) => {
				let waypoint = $selectedWaypoint[0].clone();
				waypoint.name = name;
				waypoint.desc = description;
				waypoint.cmt = comment;
				waypoint.setCoordinates({
					lat: latitude,
					lon: longitude
				});
				return file.replaceWaypoints(
					$selectedWaypoint[0]._data.index,
					$selectedWaypoint[0]._data.index,
					[waypoint]
				)[0];
			});
		} else {
			let fileIds = new Set<string>();
			$selection.getSelected().forEach((item) => {
				fileIds.add(item.getFileId());
			});
			let waypoint = new Waypoint({
				name,
				desc: description,
				cmt: comment,
				attributes: {
					lat: latitude,
					lon: longitude
				}
			});
			// TODO get elevation for waypoint
			dbUtils.applyToFiles(
				Array.from(fileIds),
				(file) => file.replaceWaypoints(file.wpt.length, file.wpt.length, [waypoint])[0]
			);
		}
		selectedWaypoint.set(undefined);
		resetWaypointData();
	}

	function setCoordinates(e: any) {
		latitude = e.lngLat.lat.toFixed(6);
		longitude = e.lngLat.lng.toFixed(6);
	}

	onMount(() => {
		let m = get(map);
		m?.on('click', setCoordinates);
		setCrosshairCursor();
	});

	onDestroy(() => {
		let m = get(map);
		m?.off('click', setCoordinates);
		resetCursor();

		if (unsubscribe) {
			unsubscribe();
			unsubscribe = undefined;
		}
	});
</script>

<div class="flex flex-col gap-3 w-96">
	<fieldset class="flex flex-col gap-2">
		<Label for="name">{$_('toolbar.waypoint.name')}</Label>
		<Input bind:value={name} id="name" class="font-semibold h-8" />
		<Label for="description">{$_('toolbar.waypoint.description')}</Label>
		<Textarea bind:value={description} id="description" />
		<Label for="comment">{$_('toolbar.waypoint.comment')}</Label>
		<Textarea bind:value={comment} id="comment" />
		<div class="flex flex-row gap-2">
			<div>
				<Label for="latitude">{$_('toolbar.waypoint.latitude')}</Label>
				<Input
					bind:value={latitude}
					type="number"
					id="latitude"
					step={1e-6}
					min={-90}
					max={90}
					class="text-xs h-8"
				/>
			</div>
			<div>
				<Label for="longitude">{$_('toolbar.waypoint.longitude')}</Label>
				<Input
					bind:value={longitude}
					type="number"
					id="longitude"
					step={1e-6}
					min={-180}
					max={180}
					class="text-xs h-8"
				/>
			</div>
		</div>
	</fieldset>
	<div class="flex flex-row gap-2">
		<Button
			variant="outline"
			disabled={!canCreate && !$selectedWaypoint}
			class="grow"
			on:click={createOrUpdateWaypoint}
		>
			{#if $selectedWaypoint}
				<RefreshCw size="16" class="mr-1" />
				{$_('toolbar.waypoint.update')}
			{:else}
				<CirclePlus size="16" class="mr-1" />
				{$_('toolbar.waypoint.create')}
			{/if}
		</Button>
		<Button
			variant="outline"
			on:click={() => {
				selectedWaypoint.set(undefined);
				resetWaypointData();
			}}
		>
			<CircleX size="16" />
		</Button>
	</div>
	<Help>
		{#if $selectedWaypoint || canCreate}
			{$_('toolbar.waypoint.help')}
		{:else}
			{$_('toolbar.waypoint.help_no_selection')}
		{/if}
	</Help>
</div>
