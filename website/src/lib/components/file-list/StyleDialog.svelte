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

	const { defaultOpacity, defaultWeight } = settings;

	let colors: string[] = [];
	let color: string | undefined = undefined;
	let opacity: number[] = [];
	let weight: number[] = [];
	let colorChanged = false;
	let opacityChanged = false;
	let weightChanged = false;

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

				open = false;
			}}
		>
			<Save size="16" class="mr-1" />
			{$_('menu.metadata.save')}
		</Button>
	</Popover.Content>
</Popover.Root>
