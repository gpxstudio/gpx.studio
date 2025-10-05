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
    import { brouterProfiles } from '$lib/components/toolbar/tools/routing/utils.svelte';
    import { i18n } from '$lib/i18n.svelte';
    // import { RoutingControls } from './RoutingControls';
    import { slide } from 'svelte/transition';
    import {
        ListFileItem,
        ListRootItem,
        ListTrackItem,
        ListTrackSegmentItem,
        type ListItem,
    } from '$lib/components/file-list/file-list';
    import { getURLForLanguage, resetCursor, setCrosshairCursor } from '$lib/utils';
    import { onDestroy, onMount } from 'svelte';
    import { TrackPoint } from 'gpx';
    import { settings } from '$lib/logic/settings.svelte';
    import { map } from '$lib/components/map/utils.svelte';
    import { fileStateCollection } from '$lib/logic/file-state.svelte';
    import { selection } from '$lib/logic/selection.svelte';
    import { fileActions, getFileIds, newGPXFile } from '$lib/logic/file-actions.svelte';

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

    let selectedItem: ListItem | null = null;

    const { privateRoads, routing, routingProfile } = settings;

    // $: if (map && popup && popupElement) {
    //     // remove controls for deleted files
    //     routingControls.forEach((controls, fileId) => {
    //         if (!$fileObservers.has(fileId)) {
    //             controls.destroy();
    //             routingControls.delete(fileId);

    //             if (selectedItem && selectedItem.getFileId() === fileId) {
    //                 selectedItem = null;
    //             }
    //         } else if ($map !== controls.map) {
    //             controls.updateMap($map);
    //         }
    //     });
    //     // add controls for new files
    //     fileStateCollection.files.forEach((file, fileId) => {
    //         if (!routingControls.has(fileId)) {
    //             routingControls.set(
    //                 fileId,
    //                 new RoutingControls($map, fileId, file, popup, popupElement)
    //             );
    //         }
    //     });
    // }

    let validSelection = $derived(
        selection.value.hasAnyChildren(new ListRootItem(), true, ['waypoints'])
    );

    function createFileWithPoint(e: any) {
        if (selection.value.size === 0) {
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
            // selectFileWhenLoaded(file._data.id);
        }
    }

    onMount(() => {
        // setCrosshairCursor();
        map.value?.on('click', createFileWithPoint);
    });

    onDestroy(() => {
        // resetCursor();
        map.value?.off('click', createFileWithPoint);

        // routingControls.forEach((controls) => controls.destroy());
        // routingControls.clear();
    });
</script>

{#if minimizable && minimized}
    <div class="-m-1.5 -mb-2">
        <Button variant="ghost" class="px-1 h-[26px]" onclick={() => (minimized = false)}>
            <SquareArrowOutDownRight size="18" />
        </Button>
    </div>
{:else}
    <div class="flex flex-col gap-3 w-full max-w-80 animate-in animate-out {className ?? ''}">
        <div class="flex flex-col gap-3">
            <Label class="flex flex-row justify-between items-center gap-2">
                <span class="flex flex-row items-center gap-1">
                    {#if routing.value}
                        <Route size="16" />
                    {:else}
                        <RouteOff size="16" />
                    {/if}
                    {i18n._('toolbar.routing.use_routing')}
                </span>
                <Tooltip label={i18n._('toolbar.routing.use_routing_tooltip')}>
                    <Switch class="scale-90" bind:checked={routing.value} />
                    <Shortcut slot="extra" key="F5" />
                </Tooltip>
            </Label>
            {#if routing.value}
                <div class="flex flex-col gap-3" in:slide>
                    <Label class="flex flex-row justify-between items-center gap-2">
                        <span class="shrink-0 flex flex-row items-center gap-1">
                            {#if routingProfile.value.includes('bike') || routingProfile.value.includes('motorcycle')}
                                <Bike size="16" />
                            {:else if routingProfile.value.includes('foot')}
                                <Footprints size="16" />
                            {:else if routingProfile.value.includes('water')}
                                <Waves size="16" />
                            {:else if routingProfile.value.includes('railway')}
                                <TrainFront size="16" />
                            {/if}
                            {i18n._('toolbar.routing.activity')}
                        </span>
                        <Select.Root type="single" bind:value={routingProfile.value}>
                            <Select.Trigger class="h-8 grow">
                                {i18n._(`toolbar.routing.activities.${routingProfile.value}`)}
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
                    <Label class="flex flex-row justify-between items-center gap-2">
                        <span class="flex flex-row gap-1">
                            <TriangleAlert size="16" />
                            {i18n._('toolbar.routing.allow_private')}
                        </span>
                        <Switch class="scale-90" bind:checked={privateRoads.value} />
                    </Label>
                </div>
            {/if}
        </div>
        <div class="flex flex-row flex-wrap justify-center gap-1">
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.reverse.tooltip')}
                variant="outline"
                class="flex flex-row gap-1 text-xs px-2"
                disabled={!validSelection}
                onclick={fileActions.reverseSelection}
            >
                <ArrowRightLeft size="12" />{i18n._('toolbar.routing.reverse.button')}
            </ButtonWithTooltip>
            <ButtonWithTooltip
                label={i18n._('toolbar.routing.route_back_to_start.tooltip')}
                variant="outline"
                class="flex flex-row gap-1 text-xs px-2"
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
                                // routingControls
                                //     .get(lastFileId)
                                //     ?.appendAnchorWithCoordinates(start.getCoordinates());
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
                class="flex flex-row gap-1 text-xs px-2"
                disabled={!validSelection}
                onclick={dbUtils.createRoundTripForSelection}
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
                class="px-1 h-6"
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
