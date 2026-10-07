<script lang="ts">
    import * as Select from '$lib/components/ui/select';
    import { Switch } from '$lib/components/ui/switch';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import Help from '$lib/components/Help.svelte';
    import ButtonWithTooltip from '$lib/components/ButtonWithTooltip.svelte';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import {
        Bike,
        Footprints,
        Waves,
        TrainFront,
        Route,
        TriangleAlert,
        ArrowRightLeft,
        House,
        RouteOff,
        Repeat,
        SquareArrowUpLeft,
        SquareArrowOutDownRight,
    } from '@lucide/svelte';
    import { routingProfiles } from '$lib/components/toolbar/tools/routing/routing';
    import { i18n } from '$lib/i18n.svelte';
    import { slide } from 'svelte/transition';
    import { get } from 'svelte/store';
    import { getURLForLanguage } from '$lib/utils';
    import { onDestroy, onMount } from 'svelte';
    import { settings } from '$lib/logic/settings';
    import { map } from '$lib/components/map/map';
    import { engine } from '$lib/engine';
    import { fileActions, newFileName } from '$lib/logic/file-actions';
    import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
    import { RoutingControls } from './routing-controls';

    let {
        minimized = $bindable(false),
        minimizable = true,
        popup = undefined,
        popupElement = undefined,
        class: className = '',
    }: {
        minimized?: boolean;
        minimizable?: boolean;
        popup?: maplibregl.Popup;
        popupElement?: HTMLDivElement;
        class?: string;
    } = $props();

    const { privateRoads, routing, routingProfile } = settings;

    const selection = engine.selection;
    let routingControls: RoutingControls | undefined = undefined;

    // the tool works on files, tracks and segments, not on waypoints
    let validSelection = $derived(
        $selection.type === 'file' || $selection.type === 'track' || $selection.type === 'segment'
    );

    function createFileWithPoint(e: any) {
        if ($selection.type === 'empty') {
            // the engine selects the new file, which starts with the trackpoint: one undo step
            engine.newFile(newFileName(), { lng: e.lngLat.lng, lat: e.lngLat.lat });
        }
    }

    onMount(() => {
        if ($map && popup && popupElement) {
            routingControls = new RoutingControls(popup, popupElement);

            mapCursor.notify(MapCursorState.TOOL_WITH_CROSSHAIR, true);
            $map.on('click', createFileWithPoint);
        }
    });

    onDestroy(() => {
        if ($map) {
            routingControls?.destroy();
            routingControls = undefined;

            mapCursor.notify(MapCursorState.TOOL_WITH_CROSSHAIR, false);
            $map.off('click', createFileWithPoint);
        }
    });
</script>

{#if minimizable && minimized}
    <div class="-m-1.5 -mb-2">
        <Button variant="ghost" size="icon-sm" class="size-6" onclick={() => (minimized = false)}>
            <SquareArrowOutDownRight size="18" class="size-4.5" />
        </Button>
    </div>
{:else}
    <div class="flex flex-col gap-3 w-full max-w-80 {className ?? ''}">
        <div class="flex flex-col gap-3">
            <Label class="justify-between">
                <span class="flex flex-row items-center gap-1">
                    {#if $routing}
                        <Route size="16" />
                    {:else}
                        <RouteOff size="16" />
                    {/if}
                    {i18n._('toolbar.routing.use_routing')}
                </span>
                <Tooltip label={i18n._('toolbar.routing.use_routing_tooltip')}>
                    <Switch bind:checked={$routing} />
                    {#snippet extra()}
                        <Shortcut key="F5" />
                    {/snippet}
                </Tooltip>
            </Label>
            {#if $routing}
                <div class="flex flex-col gap-3" in:slide>
                    <Label class="justify-between">
                        <span class="shrink-0 flex flex-row items-center gap-1">
                            {#if $routingProfile.includes('bike') || $routingProfile.includes('motorcycle')}
                                <Bike size="16" />
                            {:else if $routingProfile.includes('foot')}
                                <Footprints size="16" />
                            {:else if $routingProfile.includes('water')}
                                <Waves size="16" />
                            {:else if $routingProfile.includes('railway')}
                                <TrainFront size="16" />
                            {/if}
                            {i18n._('toolbar.routing.activity')}
                        </span>
                        <Select.Root type="single" bind:value={$routingProfile}>
                            <Select.Trigger class="grow" size="sm">
                                {i18n._(`toolbar.routing.activities.${$routingProfile}`)}
                            </Select.Trigger>
                            <Select.Content>
                                {#each Object.keys(routingProfiles) as profile}
                                    <Select.Item value={profile}
                                        >{i18n._(
                                            `toolbar.routing.activities.${profile}`
                                        )}</Select.Item
                                    >
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </Label>
                    <Label class="justify-between">
                        <span class="flex flex-row gap-1">
                            <TriangleAlert size="16" />
                            {i18n._('toolbar.routing.allow_private')}
                        </span>
                        <Switch bind:checked={$privateRoads} />
                    </Label>
                </div>
            {/if}
        </div>
        <div class="flex flex-row flex-wrap justify-center gap-1">
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.reverse.tooltip')}
                variant="outline"
                class="gap-1 text-xs px-1.5 py-1.5 h-fit"
                disabled={!validSelection}
                onclick={() => engine.reverse()}
            >
                <ArrowRightLeft class="size-3" />{i18n._('toolbar.routing.reverse.button')}
            </ButtonWithTooltip>
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.route_back_to_start.tooltip')}
                variant="outline"
                class="gap-1 text-xs px-1.5 py-1.5 h-fit"
                disabled={!validSelection}
                onclick={() => {
                    // the first trackpoint of the selection
                    const { length, lng, lat } = get(engine.statistics);
                    if (length > 0) {
                        routingControls?.appendAnchorWithCoordinates({ lng: lng[0], lat: lat[0] });
                    }
                }}
            >
                <House class="size-3" />{i18n._('toolbar.routing.route_back_to_start.button')}
            </ButtonWithTooltip>
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.round_trip.tooltip')}
                variant="outline"
                class="gap-1 text-xs px-1.5 py-1.5 h-fit"
                disabled={!validSelection}
                onclick={fileActions.createRoundTripForSelection}
            >
                <Repeat class="size-3" />{i18n._('toolbar.routing.round_trip.button')}
            </ButtonWithTooltip>
        </div>
        <div class="w-full flex flex-row gap-1 items-end justify-between">
            <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/routing')}>
                {#if !validSelection}
                    {i18n._('toolbar.routing.help_no_file')}
                {:else}
                    {i18n._('toolbar.routing.help')}
                {/if}
            </Help>
            <Button
                variant="ghost"
                size="icon-sm"
                class="size-6"
                onclick={() => {
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
