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
        Home,
        RouteOff,
        Repeat,
        SquareArrowUpLeft,
        SquareArrowOutDownRight,
    } from '@lucide/svelte';
    import { brouterProfiles } from '$lib/components/toolbar/tools/routing/routing';
    import { i18n } from '$lib/i18n.svelte';
    import { slide } from 'svelte/transition';
    import {
        ListFileItem,
        ListRootItem,
        ListTrackItem,
        ListTrackSegmentItem,
        type ListItem,
    } from '$lib/components/file-list/file-list';
    import { getURLForLanguage } from '$lib/utils';
    import { onDestroy, onMount } from 'svelte';
    import { TrackPoint } from 'gpx';
    import { settings } from '$lib/logic/settings';
    import { map } from '$lib/components/map/map';
    import { fileStateCollection, GPXFileStateCollectionObserver } from '$lib/logic/file-state';
    import { selection } from '$lib/logic/selection';
    import { fileActions, getFileIds, newGPXFile } from '$lib/logic/file-actions';
    import { mapCursor, MapCursorState } from '$lib/logic/map-cursor';
    import { RoutingControls, routingControls } from './RoutingControls';

    let {
        minimized = $bindable(false),
        minimizable = true,
        popup = undefined,
        popupElement = undefined,
        class: className = '',
    }: {
        minimized?: boolean;
        minimizable?: boolean;
        popup?: mapboxgl.Popup;
        popupElement?: HTMLDivElement;
        class?: string;
    } = $props();

    const { privateRoads, routing, routingProfile } = settings;

    let fileStateCollectionObserver: GPXFileStateCollectionObserver;

    let validSelection = $derived(
        $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints'])
    );

    function createFileWithPoint(e: any) {
        if ($selection.size === 0) {
            let file = newGPXFile();
            file.replaceTrackPoints(0, 0, 0, 0, [
                new TrackPoint({
                    attributes: {
                        lat: e.lngLat.lat,
                        lon: e.lngLat.lng,
                    },
                }),
            ]);
            file._data.id = getFileIds(1)[0];
            fileActions.add(file);
            selection.selectFileWhenLoaded(file._data.id);
        }
    }

    onMount(() => {
        if ($map && popup && popupElement) {
            fileStateCollectionObserver = new GPXFileStateCollectionObserver(
                (fileId, fileState) => {
                    routingControls.set(
                        fileId,
                        new RoutingControls(fileId, fileState, popup, popupElement)
                    );
                },
                (fileId) => {
                    const controls = routingControls.get(fileId);
                    if (controls) {
                        controls.destroy();
                        routingControls.delete(fileId);
                    }
                },
                () => {
                    routingControls.forEach((controls) => controls.destroy());
                    routingControls.clear();
                }
            );

            mapCursor.notify(MapCursorState.TOOL_WITH_CROSSHAIR, true);
            $map.on('click', createFileWithPoint);
        }
    });

    onDestroy(() => {
        if ($map) {
            if (fileStateCollectionObserver) {
                fileStateCollectionObserver.destroy();
            }

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
    <div class="flex flex-col gap-3 w-full max-w-80 animate-in animate-out {className ?? ''}">
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
                            <Select.Trigger class="h-8 grow">
                                {i18n._(`toolbar.routing.activities.${$routingProfile}`)}
                            </Select.Trigger>
                            <Select.Content>
                                {#each Object.keys(brouterProfiles) as profile}
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
                class="gap-1 text-xs"
                disabled={!validSelection}
                onclick={fileActions.reverseSelection}
            >
                <ArrowRightLeft size="12" />{i18n._('toolbar.routing.reverse.button')}
            </ButtonWithTooltip>
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.route_back_to_start.tooltip')}
                variant="outline"
                class="gap-1 text-xs"
                disabled={!validSelection}
                onclick={() => {
                    const selected = selection.getOrderedSelection();
                    if (selected.length > 0) {
                        const firstFileId = selected[0].getFileId();
                        const firstFile = fileStateCollection.getFile(firstFileId);
                        if (firstFile) {
                            let start = (() => {
                                if (selected[0] instanceof ListFileItem) {
                                    return firstFile.trk[0]?.trkseg[0]?.trkpt[0];
                                } else if (selected[0] instanceof ListTrackItem) {
                                    return firstFile.trk[selected[0].getTrackIndex()]?.trkseg[0]
                                        ?.trkpt[0];
                                } else if (selected[0] instanceof ListTrackSegmentItem) {
                                    return firstFile.trk[selected[0].getTrackIndex()]?.trkseg[
                                        selected[0].getSegmentIndex()
                                    ]?.trkpt[0];
                                }
                            })();

                            if (start !== undefined) {
                                const lastFileId = selected[selected.length - 1].getFileId();
                                routingControls
                                    .get(lastFileId)
                                    ?.appendAnchorWithCoordinates(start.getCoordinates());
                            }
                        }
                    }
                }}
            >
                <Home size="12" />{i18n._('toolbar.routing.route_back_to_start.button')}
            </ButtonWithTooltip>
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.round_trip.tooltip')}
                variant="outline"
                class="gap-1 text-xs"
                disabled={!validSelection}
                onclick={fileActions.createRoundTripForSelection}
            >
                <Repeat size="12" />{i18n._('toolbar.routing.round_trip.button')}
            </ButtonWithTooltip>
        </div>
        <div class="w-full flex flex-row gap-2 items-end justify-between">
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
