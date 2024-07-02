<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { dbUtils, getFile, settings } from '$lib/db';
	import {
		Copy,
		Info,
		MapPin,
		PaintBucket,
		Plus,
		Trash2,
		Waypoints,
		Eye,
		EyeOff,
		ClipboardCopy,
		ClipboardPaste,
		Scissors,
		FileStack,
		FileX
	} from 'lucide-svelte';
	import {
		ListFileItem,
		ListLevel,
		ListTrackItem,
		ListWaypointItem,
		allowedPastes,
		type ListItem
	} from './FileList';
	import {
		copied,
		copySelection,
		cutSelection,
		pasteSelection,
		selectAll,
		selectItem,
		selection
	} from './Selection';
	import { getContext } from 'svelte';
	import { get } from 'svelte/store';
	import { allHidden, editMetadata, editStyle, gpxLayers, map } from '$lib/stores';
	import {
		GPXTreeElement,
		Track,
		TrackSegment,
		type AnyGPXTreeElement,
		Waypoint,
		GPXFile
	} from 'gpx';
	import { _ } from 'svelte-i18n';
	import MetadataDialog from './MetadataDialog.svelte';
	import StyleDialog from './StyleDialog.svelte';

	export let node:
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>
		| Readonly<Waypoint>;
	export let item: ListItem;
	export let label: string | undefined;

	let orientation = getContext<'vertical' | 'horizontal'>('orientation');

	const { verticalFileView } = settings;

	$: singleSelection = $selection.size === 1;

	let nodeColors: string[] = [];

	$: if (node && $map) {
		nodeColors = [];

		if (node instanceof GPXFile) {
			let style = node.getStyle();

			let layer = gpxLayers.get(item.getFileId());
			if (layer) {
				style.color.push(layer.layerColor);
			}

			style.color.forEach((c) => {
				if (!nodeColors.includes(c)) {
					nodeColors.push(c);
				}
			});
		} else if (node instanceof Track) {
			let style = node.getStyle();
			if (style) {
				if (style.color && !nodeColors.includes(style.color)) {
					nodeColors.push(style.color);
				}
			}
			if (nodeColors.length === 0) {
				let layer = gpxLayers.get(item.getFileId());
				if (layer) {
					nodeColors.push(layer.layerColor);
				}
			}
		}
	}

	let openEditMetadata: boolean = false;
	let openEditStyle: boolean = false;

	$: openEditMetadata = $editMetadata && singleSelection && $selection.has(item);
	$: openEditStyle =
		$editStyle &&
		$selection.has(item) &&
		$selection.getSelected().findIndex((i) => i.getFullId() === item.getFullId()) === 0;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<ContextMenu.Root
	onOpenChange={(open) => {
		if (open) {
			if (!get(selection).has(item)) {
				selectItem(item);
			}
		}
	}}
>
	<ContextMenu.Trigger class="grow truncate">
		<Button
			variant="ghost"
			class="relative w-full p-0 px-1 border-none overflow-hidden focus-visible:ring-0 focus-visible:ring-offset-0 {orientation ===
			'vertical'
				? 'h-fit'
				: 'h-9 px-1.5 shadow-md'} pointer-events-auto"
		>
			{#if item instanceof ListFileItem || item instanceof ListTrackItem}
				<MetadataDialog bind:open={openEditMetadata} {node} {item} />
				<StyleDialog bind:open={openEditStyle} {item} />
			{/if}
			{#if item.level === ListLevel.FILE || item.level === ListLevel.TRACK}
				<div
					class="absolute {$verticalFileView
						? 'top-0 bottom-0 right-1 w-1'
						: 'top-0 h-1 left-0 right-0'}"
					style="background:linear-gradient(to {$verticalFileView ? 'bottom' : 'right'},{nodeColors
						.map(
							(c, i) =>
								`${c} ${Math.floor((100 * i) / nodeColors.length)}% ${Math.floor((100 * (i + 1)) / nodeColors.length)}%`
						)
						.join(',')})"
				/>
			{/if}
			<span
				class="w-full text-left truncate py-1 flex flex-row items-center"
				on:contextmenu={(e) => {
					if (e.ctrlKey) {
						// Add to selection instead of opening context menu
						e.preventDefault();
						e.stopPropagation();
						$selection.toggle(item);
						$selection = $selection;
					}
				}}
				on:mouseenter={() => {
					if (item instanceof ListWaypointItem) {
						let layer = gpxLayers.get(item.getFileId());
						let file = getFile(item.getFileId());
						if (layer && file) {
							let waypoint = file.wpt[item.getWaypointIndex()];
							if (waypoint) {
								layer.showWaypointPopup(waypoint);
							}
						}
					}
				}}
				on:mouseleave={() => {
					if (item instanceof ListWaypointItem) {
						let layer = gpxLayers.get(item.getFileId());
						if (layer) {
							layer.hideWaypointPopup();
						}
					}
				}}
			>
				{#if item.level === ListLevel.SEGMENT}
					<Waypoints size="16" class="mr-1 shrink-0" />
				{:else if item.level === ListLevel.WAYPOINT}
					<MapPin size="16" class="mr-1 shrink-0" />
				{/if}
				<span class="grow select-none truncate {$verticalFileView ? 'last:mr-2' : ''}">
					{label}
				</span>
				{#if (item.level !== ListLevel.WAYPOINTS && node._data.hidden) || (item.level === ListLevel.WAYPOINTS && node._data.hiddenWpt)}
					<EyeOff
						size="12"
						class="shrink-0 mt-1 ml-1 {$verticalFileView ? 'mr-2' : ''} {item.level ===
							ListLevel.SEGMENT || item.level === ListLevel.WAYPOINT
							? 'mr-3'
							: ''}"
					/>
				{/if}
			</span>
		</Button>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#if item instanceof ListFileItem || item instanceof ListTrackItem}
			<ContextMenu.Item disabled={!singleSelection} on:click={() => ($editMetadata = true)}>
				<Info size="16" class="mr-1" />
				{$_('menu.metadata.button')}
				<Shortcut key="I" ctrl={true} />
			</ContextMenu.Item>
			<ContextMenu.Item on:click={() => ($editStyle = true)}>
				<PaintBucket size="16" class="mr-1" />
				{$_('menu.style.button')}
			</ContextMenu.Item>
		{/if}
		<ContextMenu.Item
			on:click={() => {
				if ($allHidden) {
					dbUtils.setHiddenToSelection(false);
				} else {
					dbUtils.setHiddenToSelection(true);
				}
			}}
		>
			{#if $allHidden}
				<Eye size="16" class="mr-1" />
				{$_('menu.unhide')}
			{:else}
				<EyeOff size="16" class="mr-1" />
				{$_('menu.hide')}
			{/if}
			<Shortcut key="H" ctrl={true} />
		</ContextMenu.Item>
		<ContextMenu.Separator />
		{#if $verticalFileView}
			{#if item instanceof ListFileItem}
				<ContextMenu.Item
					disabled={!singleSelection}
					on:click={() =>
						dbUtils.applyToFile(
							item.getFileId(),
							(file) => file.replaceTracks(file.trk.length, file.trk.length, [new Track()])[0]
						)}
				>
					<Plus size="16" class="mr-1" />
					{$_('menu.new_track')}
				</ContextMenu.Item>
				<ContextMenu.Separator />
			{:else if item instanceof ListTrackItem}
				<ContextMenu.Item
					disabled={!singleSelection}
					on:click={() => {
						let trackIndex = item.getTrackIndex();
						dbUtils.applyToFile(
							item.getFileId(),
							(file) =>
								file.replaceTrackSegments(
									trackIndex,
									file.trk[trackIndex].trkseg.length,
									file.trk[trackIndex].trkseg.length,
									[new TrackSegment()]
								)[0]
						);
					}}
				>
					<Plus size="16" class="mr-1" />
					{$_('menu.new_segment')}
				</ContextMenu.Item>
				<ContextMenu.Separator />
			{/if}
		{/if}
		{#if item.level !== ListLevel.WAYPOINTS}
			<ContextMenu.Item on:click={selectAll}>
				<FileStack size="16" class="mr-1" />
				{$_('menu.select_all')}
				<Shortcut key="A" ctrl={true} />
			</ContextMenu.Item>
			<ContextMenu.Separator />
		{/if}
		{#if $verticalFileView}
			<ContextMenu.Item on:click={dbUtils.duplicateSelection}>
				<Copy size="16" class="mr-1" />
				{$_('menu.duplicate')}
				<Shortcut key="D" ctrl={true} /></ContextMenu.Item
			>
			{#if $verticalFileView}
				<ContextMenu.Item on:click={copySelection}>
					<ClipboardCopy size="16" class="mr-1" />
					{$_('menu.copy')}
					<Shortcut key="C" ctrl={true} />
				</ContextMenu.Item>
				<ContextMenu.Item on:click={cutSelection}>
					<Scissors size="16" class="mr-1" />
					{$_('menu.cut')}
					<Shortcut key="X" ctrl={true} />
				</ContextMenu.Item>
				<ContextMenu.Item
					disabled={$copied === undefined ||
						$copied.length === 0 ||
						!allowedPastes[$copied[0].level].includes(item.level)}
					on:click={pasteSelection}
				>
					<ClipboardPaste size="16" class="mr-1" />
					{$_('menu.paste')}
					<Shortcut key="V" ctrl={true} />
				</ContextMenu.Item>
			{/if}
			<ContextMenu.Separator />
		{/if}
		<ContextMenu.Item on:click={dbUtils.deleteSelection}>
			{#if item instanceof ListFileItem}
				<FileX size="16" class="mr-1" />
				{$_('menu.close')}
			{:else}
				<Trash2 size="16" class="mr-1" />
				{$_('menu.delete')}
			{/if}
			<Shortcut key="⌫" ctrl={true} />
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
