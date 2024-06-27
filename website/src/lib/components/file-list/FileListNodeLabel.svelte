<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider';
	import * as ContextMenu from '$lib/components/ui/context-menu';
	import * as Popover from '$lib/components/ui/popover';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import { dbUtils, getFile, settings } from '$lib/db';
	import {
		Copy,
		Info,
		MapPin,
		PaintBucket,
		Plus,
		Save,
		Trash2,
		Waypoints,
		Eye,
		EyeOff,
		ClipboardCopy,
		ClipboardPaste,
		Scissors
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
		selectItem,
		selection
	} from './Selection';
	import { getContext } from 'svelte';
	import { get } from 'svelte/store';
	import { gpxLayers, map, toggleSelectionVisibility } from '$lib/stores';
	import {
		GPXTreeElement,
		Track,
		TrackSegment,
		type AnyGPXTreeElement,
		Waypoint,
		GPXFile
	} from 'gpx';
	import { _ } from 'svelte-i18n';

	export let node:
		| GPXTreeElement<AnyGPXTreeElement>
		| ReadonlyArray<Readonly<Waypoint>>
		| Readonly<Waypoint>;
	export let item: ListItem;
	export let label: string | undefined;
	let nodeColors: string[] = [];
	let hidden = false;

	let orientation = getContext<'vertical' | 'horizontal'>('orientation');

	const { verticalFileView, defaultOpacity, defaultWeight } = settings;

	$: singleSelection = $selection.size === 1;

	let openEditMetadata: boolean = false;
	let openEditStyle: boolean = false;
	let name: string =
		node instanceof GPXFile
			? node.metadata.name ?? ''
			: node instanceof Track
				? node.name ?? ''
				: '';
	let description: string =
		node instanceof GPXFile
			? node.metadata.desc ?? ''
			: node instanceof Track
				? node.desc ?? ''
				: '';
	let colors: string[] = [];
	let color: string | undefined = undefined;
	let opacity: number[] = [];
	let weight: number[] = [];
	let colorChanged = false;
	let opacityChanged = false;
	let weightChanged = false;

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

	function setStyleInputs() {
		colors = [];
		opacity = [];
		weight = [];

		$selection.forEach((item) => {
			if (item instanceof ListFileItem) {
				let file = getFile(item.getFileId());
				let layer = gpxLayers.get(item.getFileId());
				if (file && layer) {
					let style = file.getStyle();
					style.color.push(layer.layerColor);

					style.color.forEach((c) => {
						if (!colors.includes(c)) {
							colors.push(c);
						}
					});
					style.opacity.forEach((o) => {
						if (!opacity.includes(o)) {
							opacity.push(o);
						}
					});
					style.weight.forEach((w) => {
						if (!weight.includes(w)) {
							weight.push(w);
						}
					});
				}
			} else if (item instanceof ListTrackItem) {
				let file = getFile(item.getFileId());
				let layer = gpxLayers.get(item.getFileId());
				if (file && layer) {
					let track = file.trk[item.getTrackIndex()];
					let style = track.getStyle();
					if (style) {
						if (style.color && !colors.includes(style.color)) {
							colors.push(style.color);
						}
						if (style.opacity && !opacity.includes(style.opacity)) {
							opacity.push(style.opacity);
						}
						if (style.weight && !weight.includes(style.weight)) {
							weight.push(style.weight);
						}
					}
					if (!colors.includes(layer.layerColor)) {
						colors.push(layer.layerColor);
					}
				}
			}
		});

		color = colors[0];
		opacity = [opacity[0] ?? $defaultOpacity];
		weight = [weight[0] ?? $defaultWeight];

		colorChanged = false;
		opacityChanged = false;
		weightChanged = false;
	}

	$: if ($selection && openEditStyle) {
		setStyleInputs();
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<ContextMenu.Root
	onOpenChange={(open) => {
		if (open) {
			if (!get(selection).has(item)) {
				selectItem(item);
			}
			let layer = gpxLayers.get(item.getFileId());
			if (layer) {
				hidden = layer.hidden;
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
				<Popover.Root bind:open={openEditMetadata}>
					<Popover.Trigger />
					<Popover.Content side="top" sideOffset={22} alignOffset={30} class="flex flex-col gap-3">
						<Label for="name">{$_('menu.metadata.name')}</Label>
						<Input bind:value={name} id="name" class="font-semibold h-8" />
						<Label for="description">{$_('menu.metadata.description')}</Label>
						<Textarea bind:value={description} id="description" />
						<Button
							variant="outline"
							on:click={() => {
								dbUtils.applyToFile(item.getFileId(), (file) => {
									if (item instanceof ListFileItem && node instanceof GPXFile) {
										file.metadata.name = name;
										file.metadata.desc = description;
									} else if (item instanceof ListTrackItem && node instanceof Track) {
										file.trk[item.getTrackIndex()].name = name;
										file.trk[item.getTrackIndex()].desc = description;
									}
									return file;
								});
								openEditMetadata = false;
							}}
						>
							<Save size="16" class="mr-1" />
							{$_('menu.metadata.save')}
						</Button>
					</Popover.Content>
				</Popover.Root>
				<Popover.Root bind:open={openEditStyle}>
					<Popover.Trigger />
					<Popover.Content side="top" sideOffset={22} alignOffset={30} class="flex flex-col gap-3">
						<Label class="flex flex-row gap-2 items-center justify-between">
							{$_('menu.style.color')}
							<Input
								bind:value={color}
								type="color"
								class="p-0 h-6 w-40"
								on:change={() => (colorChanged = true)}
							/>
						</Label>
						<Label class="flex flex-row gap-2 items-center justify-between">
							{$_('menu.style.opacity')}
							<div class="w-40 p-2">
								<Slider
									bind:value={opacity}
									min={0.3}
									max={1}
									step={0.1}
									onValueChange={() => (opacityChanged = true)}
								/>
							</div>
						</Label>
						<Label class="flex flex-row gap-2 items-center justify-between">
							{$_('menu.style.weight')}
							<div class="w-40 p-2">
								<Slider
									bind:value={weight}
									id="weight"
									min={1}
									max={10}
									step={1}
									onValueChange={() => (weightChanged = true)}
								/>
							</div>
						</Label>
						<Button
							variant="outline"
							disabled={!colorChanged && !opacityChanged && !weightChanged}
							on:click={() => {
								let style = {};
								if (colorChanged) {
									style.color = color;
								}
								if (opacityChanged) {
									style.opacity = opacity[0];
								}
								if (weightChanged) {
									style.weight = weight[0];
								}
								dbUtils.setStyleToSelection(style);

								if (item instanceof ListFileItem && $selection.size === gpxLayers.size) {
									if (style.opacity) {
										$defaultOpacity = style.opacity;
									}
									if (style.weight) {
										$defaultWeight = style.weight;
									}
								}

								openEditStyle = false;
							}}
						>
							<Save size="16" class="mr-1" />
							{$_('menu.metadata.save')}
						</Button>
					</Popover.Content>
				</Popover.Root>
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
				<span class="grow select-none truncate {$verticalFileView ? 'mr-2' : ''}">
					{label}
				</span>
			</span>
		</Button>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		{#if item instanceof ListFileItem || item instanceof ListTrackItem}
			<ContextMenu.Item disabled={!singleSelection} on:click={() => (openEditMetadata = true)}>
				<Info size="16" class="mr-1" />
				{$_('menu.metadata.button')}
			</ContextMenu.Item>
			<ContextMenu.Item on:click={() => (openEditStyle = true)}>
				<PaintBucket size="16" class="mr-1" />
				{$_('menu.style.button')}
			</ContextMenu.Item>
			{#if item instanceof ListFileItem}
				<ContextMenu.Item on:click={toggleSelectionVisibility}>
					{#if hidden}
						<Eye size="16" class="mr-1" />
						{$_('menu.unhide')}
					{:else}
						<EyeOff size="16" class="mr-1" />
						{$_('menu.hide')}
					{/if}
					<Shortcut key="H" ctrl={true} />
				</ContextMenu.Item>
			{/if}
			<ContextMenu.Separator />
		{/if}
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
		{#if $verticalFileView || item.level !== ListLevel.WAYPOINTS}
			{#if item.level !== ListLevel.WAYPOINTS}
				<ContextMenu.Item on:click={dbUtils.duplicateSelection}>
					<Copy size="16" class="mr-1" />
					{$_('menu.duplicate')}
					<Shortcut key="D" ctrl={true} /></ContextMenu.Item
				>
			{/if}
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
			<Trash2 size="16" class="mr-1" />
			{$_('menu.delete')}
			<Shortcut key="⌫" ctrl={true} />
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
