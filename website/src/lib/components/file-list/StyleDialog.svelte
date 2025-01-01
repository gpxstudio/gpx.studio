<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Slider } from '$lib/components/ui/slider';
	import * as Popover from '$lib/components/ui/popover';
	import { dbUtils, getFile, settings } from '$lib/db';
	import { Save } from 'lucide-svelte';
	import { ListFileItem, ListTrackItem, type ListItem } from './FileList';
	import { selection } from './Selection';
	import { editStyle, gpxLayers } from '$lib/stores';
	import { _ } from 'svelte-i18n';

	export let item: ListItem;
	export let open = false;

	const { defaultOpacity, defaultWidth } = settings;

	let colors: string[] = [];
	let color: string | undefined = undefined;
	let opacity: number[] = [];
	let width: number[] = [];
	let colorChanged = false;
	let opacityChanged = false;
	let widthChanged = false;

	function setStyleInputs() {
		colors = [];
		opacity = [];
		width = [];

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
					style.width.forEach((w) => {
						if (!width.includes(w)) {
							width.push(w);
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
						if (style['gpx_style:color'] && !colors.includes(style['gpx_style:color'])) {
							colors.push(style['gpx_style:color']);
						}
						if (style['gpx_style:opacity'] && !opacity.includes(style['gpx_style:opacity'])) {
							opacity.push(style['gpx_style:opacity']);
						}
						if (style['gpx_style:width'] && !width.includes(style['gpx_style:width'])) {
							width.push(style['gpx_style:width']);
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
		width = [width[0] ?? $defaultWidth];

		colorChanged = false;
		opacityChanged = false;
		widthChanged = false;
	}

	$: if ($selection && open) {
		setStyleInputs();
	}

	$: if (!open) {
		$editStyle = false;
	}
</script>

<Popover.Root bind:open>
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
			{$_('menu.style.width')}
			<div class="w-40 p-2">
				<Slider
					bind:value={width}
					id="width"
					min={1}
					max={10}
					step={1}
					onValueChange={() => (widthChanged = true)}
				/>
			</div>
		</Label>
		<Button
			variant="outline"
			disabled={!colorChanged && !opacityChanged && !widthChanged}
			on:click={() => {
				let style = {};
				if (colorChanged) {
					style['gpx_style:color'] = color;
				}
				if (opacityChanged) {
					style['gpx_style:opacity'] = opacity[0];
				}
				if (widthChanged) {
					style['gpx_style:width'] = width[0];
				}
				dbUtils.setStyleToSelection(style);

				if (item instanceof ListFileItem && $selection.size === gpxLayers.size) {
					if (style['gpx_style:opacity']) {
						$defaultOpacity = style['gpx_style:opacity'];
					}
					if (style['gpx_style:width']) {
						$defaultWidth = style['gpx_style:width'];
					}
				}

				open = false;
			}}
		>
			<Save size="16" class="mr-1" />
			{$_('menu.metadata.save')}
		</Button>
	</Popover.Content>
</Popover.Root>
