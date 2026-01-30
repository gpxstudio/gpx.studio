<script lang="ts">
    import { Tool, currentTool } from '$lib/components/toolbar/tools';
    import * as Card from '$lib/components/ui/card';
    import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
    import Scissors from '$lib/components/toolbar/tools/scissors/Scissors.svelte';
    import Waypoint from '$lib/components/toolbar/tools/waypoint/Waypoint.svelte';
    import Time from '$lib/components/toolbar/tools/Time.svelte';
    import Merge from '$lib/components/toolbar/tools/Merge.svelte';
    import Elevation from '$lib/components/toolbar/tools/Elevation.svelte';
    import Extract from '$lib/components/toolbar/tools/Extract.svelte';
    import Clean from '$lib/components/toolbar/tools/Clean.svelte';
    import Reduce from '$lib/components/toolbar/tools/reduce/Reduce.svelte';
    import RoutingControlPopup from '$lib/components/toolbar/tools/routing/RoutingControlPopup.svelte';
    import maplibregl from 'maplibre-gl';
    import { settings } from '$lib/logic/settings';

    let {
        class: className = '',
    }: {
        class: string;
    } = $props();

    const { minimizeRoutingMenu } = settings;

    let popupElement: HTMLDivElement | undefined = $state(undefined);
    let popup: maplibregl.Popup | undefined = $derived.by(() => {
        if (!popupElement) {
            return undefined;
        }
        let popup = new maplibregl.Popup({
            closeButton: false,
            maxWidth: undefined,
        });
        popup.setDOMContent(popupElement);
        popupElement.classList.remove('hidden');
        return popup;
    });
</script>

{#if $currentTool !== null}
    <div
        class="translate-x-1 h-full animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 {className}"
    >
        <div class="rounded-md shadow-md pointer-events-auto">
            <Card.Root class="rounded-md border-none py-2.5">
                <Card.Content class="px-2.5">
                    {#if $currentTool === Tool.ROUTING}
                        <Routing {popup} {popupElement} bind:minimized={$minimizeRoutingMenu} />
                    {:else if $currentTool === Tool.SCISSORS}
                        <Scissors />
                    {:else if $currentTool === Tool.WAYPOINT}
                        <Waypoint />
                    {:else if $currentTool === Tool.TIME}
                        <Time />
                    {:else if $currentTool === Tool.MERGE}
                        <Merge />
                    {:else if $currentTool === Tool.ELEVATION}
                        <Elevation />
                    {:else if $currentTool === Tool.EXTRACT}
                        <Extract />
                    {:else if $currentTool === Tool.CLEAN}
                        <Clean />
                    {:else if $currentTool === Tool.REDUCE}
                        <Reduce />
                    {/if}
                </Card.Content>
            </Card.Root>
        </div>
    </div>
{/if}

<svelte:window
    on:keydown={(e) => {
        if ($currentTool !== null && e.key === 'Escape') {
            $currentTool = null;
        }
    }}
/>

<RoutingControlPopup bind:element={popupElement} />
