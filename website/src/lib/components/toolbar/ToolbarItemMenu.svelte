<script lang="ts">
    import { Tool, tool } from '$lib/components/toolbar/tools';
    import * as Card from '$lib/components/ui/card';
    import Routing from '$lib/components/toolbar/tools/routing/Routing.svelte';
    import Scissors from '$lib/components/toolbar/tools/scissors/Scissors.svelte';
    import Waypoint from '$lib/components/toolbar/tools/waypoint/Waypoint.svelte';
    import Time from '$lib/components/toolbar/tools/Time.svelte';
    import Merge from '$lib/components/toolbar/tools/Merge.svelte';
    import Extract from '$lib/components/toolbar/tools/Extract.svelte';
    import Elevation from '$lib/components/toolbar/tools/Elevation.svelte';
    import Clean from '$lib/components/toolbar/tools/Clean.svelte';
    import Reduce from '$lib/components/toolbar/tools/Reduce.svelte';
    import RoutingControlPopup from '$lib/components/toolbar/tools/routing/RoutingControlPopup.svelte';
    import { onMount } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import { settings } from '$lib/logic/settings';

    let {
        popupElement,
        popup,
        class: className = '',
    }: {
        popupElement: HTMLDivElement;
        popup: mapboxgl.Popup;
        class: string;
    } = $props();

    const { minimizeRoutingMenu } = settings;

    onMount(() => {
        popup = new mapboxgl.Popup({
            closeButton: false,
            maxWidth: undefined,
        });
        popup.setDOMContent(popupElement);
        popupElement.classList.remove('hidden');
    });
</script>

{#if tool.current !== null}
    <div class="translate-x-1 h-full animate-in animate-out {className}">
        <div class="rounded-md shadow-md pointer-events-auto">
            <Card.Root class="rounded-md border-none">
                <Card.Content class="p-2.5">
                    {#if tool.current === Tool.ROUTING}
                        <Routing
                            {popup}
                            {popupElement}
                            bind:minimized={minimizeRoutingMenu.value}
                        />
                    {:else if tool.current === Tool.SCISSORS}
                        <Scissors />
                    {:else if tool.current === Tool.WAYPOINT}
                        <Waypoint />
                    {:else if tool.current === Tool.TIME}
                        <Time />
                    {:else if tool.current === Tool.MERGE}
                        <Merge />
                    {:else if tool.current === Tool.ELEVATION}
                        <Elevation />
                    {:else if tool.current === Tool.EXTRACT}
                        <Extract />
                    {:else if tool.current === Tool.CLEAN}
                        <Clean />
                    {:else if tool.current === Tool.REDUCE}
                        <Reduce />
                    {/if}
                </Card.Content>
            </Card.Root>
        </div>
    </div>
{/if}

<svelte:window
    on:keydown={(e) => {
        if (tool.current !== null && e.key === 'Escape') {
            tool.current = null;
        }
    }}
/>

<RoutingControlPopup bind:element={popupElement} />
