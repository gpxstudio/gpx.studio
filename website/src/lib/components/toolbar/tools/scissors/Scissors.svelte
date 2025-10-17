<script lang="ts">
    import { splitAs, SplitType } from '$lib/components/toolbar/tools/scissors/scissors';
    import Help from '$lib/components/Help.svelte';
    import { ListRootItem } from '$lib/components/file-list/file-list';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import { Slider } from '$lib/components/ui/slider';
    import * as Select from '$lib/components/ui/select';
    import { Separator } from '$lib/components/ui/separator';
    import { gpxStatistics, slicedGPXStatistics } from '$lib/stores';
    import { map } from '$lib/components/map/map';
    import { get } from 'svelte/store';
    import { i18n } from '$lib/i18n.svelte';
    import { onDestroy, tick } from 'svelte';
    import { Crop } from '@lucide/svelte';
    import { dbUtils } from '$lib/db';
    import { SplitControls } from './split-controls';
    import { getURLForLanguage } from '$lib/utils';
    import { selection } from '$lib/logic/selection';

    let props: {
        class?: string;
    } = $props();

    let splitControls: SplitControls | undefined = undefined;
    let canCrop = $state(false);

    $effect(() => {
        if (map.current) {
            if (splitControls) {
                splitControls.destroy();
            }
            splitControls = new SplitControls(map.current);
        }
    });

    let validSelection = $derived(
        selection.value.hasAnyChildren(new ListRootItem(), true, ['waypoints']) &&
            $gpxStatistics.local.points.length > 0
    );

    let maxSliderValue = $state(1);
    let sliderValues = $state([0, 1]);

    function updateCanCrop() {
        canCrop = sliderValues[0] != 0 || sliderValues[1] != maxSliderValue;
    }

    function updateSlicedGPXStatistics() {
        if (validSelection && canCrop) {
            $slicedGPXStatistics = [
                get(gpxStatistics).slice(sliderValues[0], sliderValues[1]),
                sliderValues[0],
                sliderValues[1],
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

    $effect(() => {
        if ($gpxStatistics.local.points.length - 1 != maxSliderValue) {
            updateSliderLimits();
        }
    });

    $effect(() => {
        if (sliderValues) {
            updateCanCrop();
            updateSlicedGPXStatistics();
        }
    });

    $effect(() => {
        if (
            $slicedGPXStatistics !== undefined &&
            ($slicedGPXStatistics[1] !== sliderValues[0] ||
                $slicedGPXStatistics[2] !== sliderValues[1])
        ) {
            updateSliderValues();
            updateCanCrop();
        }
    });

    onDestroy(() => {
        $slicedGPXStatistics = undefined;
        if (splitControls) {
            splitControls.destroy();
            splitControls = undefined;
        }
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <div class="p-2">
        <Slider
            bind:value={sliderValues}
            max={maxSliderValue}
            step={1}
            type="multiple"
            disabled={!validSelection}
        />
    </div>
    <Button
        variant="outline"
        disabled={!validSelection || !canCrop}
        onclick={() => dbUtils.cropSelection(sliderValues[0], sliderValues[1])}
    >
        <Crop size="16" class="mr-1" />{i18n._('toolbar.scissors.crop')}
    </Button>
    <Separator />
    <Label class="flex flex-row flex-wrap gap-3 items-center">
        <span class="shrink-0">
            {i18n._('toolbar.scissors.split_as')}
        </span>
        <Select.Root bind:value={splitAs.current} type="single">
            <Select.Trigger class="h-8 w-fit grow">
                {i18n._('gpx.' + splitAs)}
            </Select.Trigger>
            <Select.Content>
                {#each Object.values(SplitType) as splitType}
                    <Select.Item value={splitType}>{i18n._('gpx.' + splitType)}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
    </Label>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/scissors')}>
        {#if validSelection}
            {i18n._('toolbar.scissors.help')}
        {:else}
            {i18n._('toolbar.scissors.help_invalid_selection')}
        {/if}
    </Help>
</div>
