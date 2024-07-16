<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button';
	import Help from '$lib/components/Help.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		Bike,
		Footprints,
		Waves,
		TrainFront,
		Route,
		TriangleAlert,
		ArrowRightLeft,
		Home,
		RouteOff,
		Repeat,
		SquareArrowUpLeft,
		SquareArrowOutDownRight
	} from 'lucide-svelte';

	import { map, newGPXFile, routingControls, selectFileWhenLoaded } from '$lib/stores';
	import { dbUtils, getFile, getFileIds, settings } from '$lib/db';
	import { brouterProfiles, routingProfileSelectItem } from './Routing';

	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { RoutingControls } from './RoutingControls';
	import mapboxgl from 'mapbox-gl';
	import { fileObservers } from '$lib/db';
	import { slide } from 'svelte/transition';
	import { getOrderedSelection, selection } from '$lib/components/file-list/Selection';
	import {
		ListFileItem,
		ListRootItem,
		ListTrackItem,
		ListTrackSegmentItem,
		type ListItem
	} from '$lib/components/file-list/FileList';
	import { flyAndScale, resetCursor, setCrosshairCursor } from '$lib/utils';
	import { onDestroy, onMount } from 'svelte';
	import { TrackPoint } from 'gpx';

	export let minimized = false;
	export let minimizable = true;
	export let popup: mapboxgl.Popup | undefined = undefined;
	export let popupElement: HTMLElement | undefined = undefined;
	let selectedItem: ListItem | null = null;

	const { privateRoads, routing } = settings;

	$: if ($map && popup && popupElement) {
		// remove controls for deleted files
		routingControls.forEach((controls, fileId) => {
			if (!$fileObservers.has(fileId)) {
				controls.destroy();
				routingControls.delete(fileId);

				if (selectedItem && selectedItem.getFileId() === fileId) {
					selectedItem = null;
				}
			} else if ($map !== controls.map) {
				controls.updateMap($map);
			}
		});
		// add controls for new files
		$fileObservers.forEach((file, fileId) => {
			if (!routingControls.has(fileId)) {
				routingControls.set(fileId, new RoutingControls($map, fileId, file, popup, popupElement));
			}
		});
	}

	$: validSelection = $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints']);

	function createFileWithPoint(e: any) {
		if ($selection.size === 0) {
			let file = newGPXFile();
			file.replaceTrackPoints(0, 0, 0, 0, [
				new TrackPoint({
					attributes: {
						lat: e.lngLat.lat,
						lon: e.lngLat.lng
					}
				})
			]);
			file._data.id = getFileIds(1)[0];
			dbUtils.add(file);
			selectFileWhenLoaded(file._data.id);
		}
	}

	onMount(() => {
		setCrosshairCursor();
		$map?.on('click', createFileWithPoint);
	});

	onDestroy(() => {
		resetCursor();
		$map?.off('click', createFileWithPoint);

		routingControls.forEach((controls) => controls.destroy());
		routingControls.clear();
	});
</script>

{#if minimized}
	<div class="-m-1.5 -mb-2">
		<Button variant="ghost" class="px-1 h-[26px]" on:click={() => (minimized = false)}>
			<SquareArrowOutDownRight size="18" />
		</Button>
	</div>
{:else}
	<div
		class="flex flex-col gap-3 w-full max-w-80 {$$props.class ?? ''}"
		in:flyAndScale={{ x: -2, y: 0, duration: 50 }}
	>
		<div class="grow flex flex-col gap-3">
			<Tooltip>
				<Label slot="data" class="w-full flex flex-row justify-between items-center gap-2">
					<span class="flex flex-row gap-1">
						{#if $routing}
							<Route size="16" />
						{:else}
							<RouteOff size="16" />
						{/if}
						{$_('toolbar.routing.use_routing')}
					</span>
					<Switch class="scale-90" bind:checked={$routing} />
				</Label>
				<span slot="tooltip">{$_('toolbar.routing.use_routing_tooltip')}</span>
			</Tooltip>
			{#if $routing}
				<div class="flex flex-col gap-3" in:slide>
					<Label class="w-full flex flex-row justify-between items-center gap-2">
						<span class="shrink-0 flex flex-row items-center gap-1">
							{#if $routingProfileSelectItem.value.includes('bike') || $routingProfileSelectItem.value.includes('motorcycle')}
								<Bike size="16" />
							{:else if $routingProfileSelectItem.value.includes('foot')}
								<Footprints size="16" />
							{:else if $routingProfileSelectItem.value.includes('water')}
								<Waves size="16" />
							{:else if $routingProfileSelectItem.value.includes('railway')}
								<TrainFront size="16" />
							{/if}
							{$_('toolbar.routing.activity')}
						</span>
						<Select.Root bind:selected={$routingProfileSelectItem}>
							<Select.Trigger class="h-8 grow">
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
					</Label>
					<Label class="w-full flex flex-row justify-between items-center gap-2">
						<span class="flex flex-row gap-1"
							><TriangleAlert size="16" />{$_('toolbar.routing.allow_private')}</span
						>
						<Switch class="scale-90" bind:checked={$privateRoads} />
					</Label>
				</div>
			{/if}
		</div>
		<div class="flex flex-row flex-wrap justify-center gap-1">
			<Tooltip>
				<Button
					slot="data"
					variant="outline"
					class="flex flex-row gap-1 text-xs px-2"
					disabled={!validSelection}
					on:click={dbUtils.reverseSelection}
				>
					<ArrowRightLeft size="12" />{$_('toolbar.routing.reverse.button')}
				</Button>
				<span slot="tooltip">{$_('toolbar.routing.reverse.tooltip')}</span>
			</Tooltip>
			<Tooltip>
				<Button
					slot="data"
					variant="outline"
					class="flex flex-row gap-1 text-xs px-2"
					disabled={!validSelection}
					on:click={() => {
						const selected = getOrderedSelection();
						if (selected.length > 0) {
							const firstFileId = selected[0].getFileId();
							const firstFile = getFile(firstFileId);
							if (firstFile) {
								let start = (() => {
									if (selected[0] instanceof ListFileItem) {
										return firstFile.trk[0]?.trkseg[0]?.trkpt[0];
									} else if (selected[0] instanceof ListTrackItem) {
										return firstFile.trk[selected[0].getTrackIndex()]?.trkseg[0]?.trkpt[0];
									} else if (selected[0] instanceof ListTrackSegmentItem) {
										return firstFile.trk[selected[0].getTrackIndex()]?.trkseg[
											selected[0].getSegmentIndex()
										]?.trkpt[0];
									}
								})();

								if (start !== undefined) {
									const lastFileId = selected[selected.length - 1].getFileId();
									routingControls
										.get(lastFileId)
										?.appendAnchorWithCoordinates(start.getCoordinates());
								}
							}
						}
					}}
				>
					<Home size="12" />{$_('toolbar.routing.route_back_to_start.button')}
				</Button>
				<span slot="tooltip">{$_('toolbar.routing.route_back_to_start.tooltip')}</span>
			</Tooltip>
			<Tooltip>
				<Button
					slot="data"
					variant="outline"
					class="flex flex-row gap-1 text-xs px-2"
					disabled={!validSelection}
					on:click={dbUtils.createRoundTripForSelection}
				>
					<Repeat size="12" />{$_('toolbar.routing.round_trip.button')}
				</Button>
				<span slot="tooltip">{$_('toolbar.routing.round_trip.tooltip')}</span>
			</Tooltip>
		</div>
		<div class="w-full flex flex-row gap-2 items-end justify-between">
			<Help>
				{#if !validSelection}
					<div>{$_('toolbar.routing.help_no_file')}</div>
				{:else}
					<div>{$_('toolbar.routing.help')}</div>
				{/if}
			</Help>
			<Button
				variant="ghost"
				class="px-1 h-6"
				on:click={() => {
					if (minimizable) {
						minimized = true;
					}
				}}
			>
				<SquareArrowUpLeft size="18" />
			</Button>
		</div>
	</div>
{/if}
