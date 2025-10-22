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
    import type { GPXStatistics } from 'gpx';
    import { settings } from '$lib/logic/settings';
    import { i18n } from '$lib/i18n.svelte';
    import { ElevationProfile } from '$lib/components/elevation-profile/elevation-profile';

    const { velocityUnits } = settings;

    let {
        gpxStatistics,
        slicedGPXStatistics,
        additionalDatasets,
        elevationFill,
        showControls = true,
    }: {
        gpxStatistics: Readable<GPXStatistics>;
        slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined>;
        additionalDatasets: Writable<string[]>;
        elevationFill: Writable<'slope' | 'surface' | 'highway' | undefined>;
        showControls?: boolean;
    } = $props();

    let canvas: HTMLCanvasElement;
    let overlay: HTMLCanvasElement;
    let elevationProfile: ElevationProfile;

    onMount(() => {
        elevationProfile = new ElevationProfile(
            gpxStatistics,
            slicedGPXStatistics,
            additionalDatasets,
            elevationFill,
            canvas,
            overlay
        );
    });

    onDestroy(() => {
        elevationProfile.destroy();
    });
</script>

<div class="h-full grow min-w-0 relative py-2">
    <canvas bind:this={overlay} class="w-full h-full absolute pointer-events-none"></canvas>
    <canvas bind:this={canvas} class="w-full h-full absolute"></canvas>
    {#if showControls}
        <div class="absolute bottom-10 right-1.5">
            <Popover.Root>
                <Popover.Trigger>
                    <ButtonWithTooltip
                        label={i18n._('chart.settings')}
                        variant="outline"
                        side="left"
                        class="w-7 h-7 p-0 flex justify-center opacity-70 hover:opacity-100 transition-opacity duration-300 hover:bg-background"
                    >
                        <ChartNoAxesColumn size="18" />
                    </ButtonWithTooltip>
                </Popover.Trigger>
                <Popover.Content
                    class="w-fit p-0 flex flex-col"
                    side="top"
                    align="end"
                    sideOffset={-32}
                >
                    <ToggleGroup.Root
                        class="flex flex-col items-start gap-0 p-1 w-full border-none"
                        type="single"
                        bind:value={$elevationFill}
                    >
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="slope"
                        >
                            <div class="w-6 flex justify-center items-center">
                                {#if $elevationFill === 'slope'}
                                    <Circle class="size-1.5 fill-current text-current" />
                                {/if}
                            </div>
                            <TriangleRight size="15" />
                            {i18n._('quantities.slope')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="surface"
                            variant="outline"
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
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="highway"
                            variant="outline"
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
                        class="flex flex-col items-start gap-0 p-1"
                        type="multiple"
                        bind:value={$additionalDatasets}
                    >
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="speed"
                        >
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
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="hr"
                        >
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('hr')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <HeartPulse size="15" />
                            {i18n._('quantities.heartrate')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="cad"
                        >
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('cad')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <Orbit size="15" />
                            {i18n._('quantities.cadence')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="atemp"
                        >
                            <div class="w-6 flex justify-center items-center">
                                {#if $additionalDatasets.includes('atemp')}
                                    <Check size="14" />
                                {/if}
                            </div>
                            <Thermometer size="15" />
                            {i18n._('quantities.temperature')}
                        </ToggleGroup.Item>
                        <ToggleGroup.Item
                            class="p-0 pr-1.5 h-6 w-full gap-1.5 rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
                            value="power"
                        >
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
