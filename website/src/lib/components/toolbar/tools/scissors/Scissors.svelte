<script lang="ts">
    import { splitAs, SplitType } from '$lib/components/toolbar/tools/scissors/scissors';
    import Help from '$lib/components/Help.svelte';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import { Slider } from '$lib/components/ui/slider';
    import * as Select from '$lib/components/ui/select';
    import { Separator } from '$lib/components/ui/separator';
    import { map } from '$lib/components/map/map';
    import { i18n } from '$lib/i18n.svelte';
    import { onDestroy, onMount, untrack } from 'svelte';
    import { Crop } from '@lucide/svelte';
    import { SplitControls } from './split-controls';
    import { getURLForLanguage } from '$lib/utils';
    import { slicedStatistics } from '$lib/logic/selection-statistics';
    import { engine } from '$lib/engine';

    let props: {
        class?: string;
    } = $props();

    let splitControls: SplitControls | undefined = undefined;

    const selection = engine.selection;
    const statistics = engine.statistics;

    // the tool works on files, tracks and segments, not on waypoints
    let validSelection = $derived(
        ($selection.type === 'file' ||
            $selection.type === 'track' ||
            $selection.type === 'segment') &&
            $statistics.length > 0
    );
    // The slider does work for each of its steps every time it changes, which is too slow with
    // the thousands of trackpoints of a long track: it has a limited number of steps, which are
    // spread over the trackpoints.
    const MAX_STEPS = 500;
    let length = $derived($statistics.length);
    let steps = $derived(validSelection ? Math.min(length - 1, MAX_STEPS) : 1);
    let sliderValues = $state([0, 1]);

    /** The index of the trackpoint of a step of the slider. */
    function toIndex(step: number) {
        return steps <= 0 || steps >= length - 1 ? step : Math.round((step * (length - 1)) / steps);
    }

    /** The step of the slider that is the closest to a trackpoint. */
    function toStep(index: number) {
        return steps <= 0 || steps >= length - 1
            ? index
            : Math.round((index * steps) / (length - 1));
    }

    onMount(() => {
        if ($map) {
            splitControls = new SplitControls($map, map.layerEventManager!);
        }
    });

    /** The user moved the slider: the part of the selection between its bounds is highlighted. */
    function updateSlicedStatistics([startStep, endStep]: number[]) {
        if (validSelection && (startStep !== 0 || endStep !== steps)) {
            const [start, end] = [toIndex(startStep), toIndex(endStep)];
            const global = $statistics.slice(start, end);
            slicedStatistics.set(global && { global, start, end });
        } else {
            slicedStatistics.set(undefined);
        }
    }

    // The slider follows the highlighted part, which can also be chosen on the elevation profile or
    // reset (when the selection changes): it covers the whole selection when there is none.
    // It only goes this way, the slider tells about its own changes (`onValueChange`).
    $effect(() => {
        const sliced = $slicedStatistics;
        const max = steps;
        untrack(() => {
            const bounds = sliced ? [toStep(sliced.start), toStep(sliced.end)] : [0, max];
            if (sliderValues[0] !== bounds[0] || sliderValues[1] !== bounds[1]) {
                sliderValues = bounds;
            }
        });
    });

    onDestroy(() => {
        slicedStatistics.set(undefined);
        if (splitControls) {
            splitControls.destroy();
        }
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <div class="p-2">
        <Slider
            bind:value={sliderValues}
            onValueChange={updateSlicedStatistics}
            max={steps}
            step={1}
            type="multiple"
            disabled={!validSelection}
        />
    </div>
    <Button
        variant="outline"
        disabled={!validSelection || !$slicedStatistics}
        onclick={() =>
            $slicedStatistics && engine.crop($slicedStatistics.start, $slicedStatistics.end)}
    >
        <Crop size="16" />{i18n._('toolbar.scissors.crop')}
    </Button>
    <Separator />
    <Label class="flex flex-row flex-wrap gap-3 items-center">
        <span class="shrink-0">
            {i18n._('toolbar.scissors.split_as')}
        </span>
        <Select.Root bind:value={$splitAs} type="single">
            <Select.Trigger class="w-fit grow" size="sm">
                {i18n._('gpx.' + $splitAs)}
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
