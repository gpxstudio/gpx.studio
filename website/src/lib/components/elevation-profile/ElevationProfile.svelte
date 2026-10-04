<script lang="ts">
    import ButtonWithTooltip from '$lib/components/ButtonWithTooltip.svelte';
    import * as Popover from '$lib/components/ui/popover/index.js';
    import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
    import Separator from '$lib/components/ui/separator/separator.svelte';
    import { onDestroy, onMount } from 'svelte';
    import {
        BrickWall,
        TriangleRight,
        HeartPulse,
        Orbit,
        SquareActivity,
        Thermometer,
        Zap,
        Circle,
        Check,
        ChartNoAxesColumn,
        Construction,
    } from '@lucide/svelte';
    import type { Readable, Writable } from 'svelte/store';
    import type { Coordinates } from 'gpx';
    import type { SelectionStatistics } from '$lib/engine';
    import type { SlicedStatistics } from '$lib/logic/selection-statistics';
    import { settings } from '$lib/logic/settings';
    import { i18n } from '$lib/i18n.svelte';
    import { ElevationProfile } from '$lib/components/elevation-profile/elevation-profile';

    const { velocityUnits } = settings;

    let {
        statistics,
        slicedStatistics,
        hoveredPoint,
        additionalDatasets,
        elevationFill,
        showControls = true,
    }: {
        statistics: Readable<SelectionStatistics>;
        slicedStatistics: Writable<SlicedStatistics | undefined>;
        hoveredPoint: Writable<Coordinates | null>;
        additionalDatasets: Writable<string[]>;
        elevationFill: Writable<'slope' | 'surface' | 'highway' | undefined>;
        showControls?: boolean;
    } = $props();

    let canvas: HTMLCanvasElement;
    let overlay: HTMLCanvasElement;
    let elevationProfile: ElevationProfile | null = null;

    onMount(() => {
        elevationProfile = new ElevationProfile(
            statistics,
            slicedStatistics,
            hoveredPoint,
            additionalDatasets,
            elevationFill,
            canvas,
            overlay
        );
    });

    onDestroy(() => {
        if (elevationProfile) {
            elevationProfile.destroy();
        }
    });
</script>

<div class="h-full grow min-w-0 min-h-0 relative">
    <canvas bind:this={overlay} class="w-full h-full absolute pointer-events-none"></canvas>
    <canvas bind:this={canvas} class="w-full h-full absolute"></canvas>
    {#if showControls}
        <div class="absolute bottom-9 right-2.5">
            <Popover.Root>
                <Popover.Trigger>
                    <ButtonWithTooltip
                        label={i18n._('chart.settings')}
                        variant="outline"
                        side="left"
                        class="w-7 h-7 p-0 flex justify-center opacity-70 hover:opacity-100 transition-opacity duration-300 bg-background"
                    >
                        <ChartNoAxesColumn size="18" />
                    </ButtonWithTooltip>
                </Popover.Trigger>
                <Popover.Content
                    class="w-fit p-0 flex flex-col gap-0 overflow-hidden"
                    side="top"
                    align="end"
                    sideOffset={-32}
                >
                    <ToggleGroup.Root
                        class="flex flex-col w-full border-none"
                        type="single"
                        size="sm"
                        bind:value={$elevationFill}
                    >
                        <ToggleGroup.Item value="slope" class="w-full flex flex-row justify-start">
                            <div class="w-6 flex justify-center items-center">
                                {#if $elevationFill === 'slope'}
                                    <Circle class="size-1.5 fill-current text-current" />
                                {/if}
                            </div>
                            <TriangleRight size="15" />
                            {i18n._('quantities.slope')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item
                            value="surface"
                            class="w-full flex flex-row justify-start"
                        >
                            <div class="w-6 flex justify-center items-center">
                                {#if $elevationFill === 'surface'}
                                    <Circle class="size-1.5 fill-current text-current" />
                                {/if}
                            </div>
                            <BrickWall size="15" />
                            {i18n._('quantities.surface')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item
                            value="highway"
                            class="w-full flex flex-row justify-start"
                        >
                            <div class="w-6 flex justify-center items-center">
                                {#if $elevationFill === 'highway'}
                                    <Circle class="size-1.5 fill-current text-current" />
                                {/if}
                            </div>
                            <Construction size="15" />
                            {i18n._('quantities.highway')}
                        </ToggleGroup.Item>
                    </ToggleGroup.Root>
                    <Separator />
                    <ToggleGroup.Root
                        class="flex flex-col gap-0"
                        type="multiple"
                        size="sm"
                        bind:value={$additionalDatasets}
                    >
                        <ToggleGroup.Item value="speed" class="w-full flex flex-row justify-start">
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('speed')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <Zap size="15" />
                            {$velocityUnits === 'speed'
                                ? i18n._('quantities.speed')
                                : i18n._('quantities.pace')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item value="hr" class="w-full flex flex-row justify-start">
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('hr')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <HeartPulse size="15" />
                            {i18n._('quantities.heartrate')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item value="cad" class="w-full flex flex-row justify-start">
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('cad')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <Orbit size="15" />
                            {i18n._('quantities.cadence')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item value="atemp" class="w-full flex flex-row justify-start">
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('atemp')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <Thermometer size="15" />
                            {i18n._('quantities.temperature')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item value="power" class="w-full flex flex-row justify-start">
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('power')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <SquareActivity size="15" />
                            {i18n._('quantities.power')}
                        </ToggleGroup.Item>
                    </ToggleGroup.Root>
                </Popover.Content>
            </Popover.Root>
        </div>
    {/if}
</div>
