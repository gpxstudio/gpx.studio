<script lang="ts" context="module">
	export enum SplitType {
		FILES = 'files',
		TRACKS = 'tracks',
		SEGMENTS = 'segments'
	}
</script>

<script lang="ts">
	import Help from '$lib/components/Help.svelte';
	import { ListRootItem } from '$lib/components/file-list/FileList';
	import { selection } from '$lib/components/file-list/Selection';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Select from '$lib/components/ui/select';
	import { Separator } from '$lib/components/ui/separator';
	import { gpxStatistics, map, slicedGPXStatistics, splitAs } from '$lib/stores';
	import { get } from 'svelte/store';
	import { _, locale } from 'svelte-i18n';
	import { onDestroy, tick } from 'svelte';
	import { Crop } from 'lucide-svelte';
	import { dbUtils } from '$lib/db';
	import { SplitControls } from './SplitControls';
	import { getURLForLanguage } from '$lib/utils';

	let splitControls: SplitControls | undefined = undefined;
	let canCrop = false;

	$: if ($map) {
		if (splitControls) {
			splitControls.destroy();
		}
		splitControls = new SplitControls($map);
	}

	$: validSelection =
		$selection.hasAnyChildren(new ListRootItem(), true, ['waypoints']) &&
		$gpxStatistics.local.points.length > 0;

	let maxSliderValue = 1;
	let sliderValues = [0, 1];

	function updateCanCrop() {
		canCrop = sliderValues[0] != 0 || sliderValues[1] != maxSliderValue;
	}

	function updateSlicedGPXStatistics() {
		if (validSelection && canCrop) {
			$slicedGPXStatistics = [
				get(gpxStatistics).slice(sliderValues[0], sliderValues[1]),
				sliderValues[0],
				sliderValues[1]
			];
		} else {
			$slicedGPXStatistics = undefined;
		}
	}

	function updateSliderValues() {
		if ($slicedGPXStatistics !== undefined) {
			sliderValues = [$slicedGPXStatistics[1], $slicedGPXStatistics[2]];
		}
	}

	async function updateSliderLimits() {
		if (validSelection && $gpxStatistics.local.points.length > 0) {
			maxSliderValue = $gpxStatistics.local.points.length - 1;
		} else {
			maxSliderValue = 1;
		}
		await tick();
		sliderValues = [0, maxSliderValue];
	}

	$: if ($gpxStatistics.local.points.length - 1 != maxSliderValue) {
		updateSliderLimits();
	}

	$: if (sliderValues) {
		updateCanCrop();
		updateSlicedGPXStatistics();
	}

	$: if (
		$slicedGPXStatistics !== undefined &&
		($slicedGPXStatistics[1] !== sliderValues[0] || $slicedGPXStatistics[2] !== sliderValues[1])
	) {
		updateSliderValues();
		updateCanCrop();
	}

	const splitTypes = [
		{ value: SplitType.FILES, label: $_('gpx.files') },
		{ value: SplitType.TRACKS, label: $_('gpx.tracks') },
		{ value: SplitType.SEGMENTS, label: $_('gpx.segments') }
	];

	let splitType = splitTypes.find((type) => type.value === $splitAs) ?? splitTypes[0];

	$: splitAs.set(splitType.value);

	onDestroy(() => {
		$slicedGPXStatistics = undefined;
		if (splitControls) {
			splitControls.destroy();
			splitControls = undefined;
		}
	});
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {$$props.class ?? ''}">
	<div class="p-2">
		<Slider bind:value={sliderValues} max={maxSliderValue} step={1} disabled={!validSelection} />
	</div>
	<Button
		variant="outline"
		disabled={!validSelection || !canCrop}
		on:click={() => dbUtils.cropSelection(sliderValues[0], sliderValues[1])}
	>
		<Crop size="16" class="mr-1" />{$_('toolbar.scissors.crop')}
	</Button>
	<Separator />
	<Label class="flex flex-row flex-wrap gap-3 items-center">
		<span class="shrink-0">
			{$_('toolbar.scissors.split_as')}
		</span>
		<Select.Root bind:selected={splitType}>
			<Select.Trigger class="h-8 w-fit grow">
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				{#each splitTypes as { value, label }}
					<Select.Item {value}>{label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</Label>
	<Help link={getURLForLanguage($locale, '/help/toolbar/scissors')}>
		{#if validSelection}
			{$_('toolbar.scissors.help')}
		{:else}
			{$_('toolbar.scissors.help_invalid_selection')}
		{/if}
	</Help>
</div>
