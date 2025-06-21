<script lang="ts">
    import { streetViewEnabled } from '$lib/components/map/street-view-control/utils.svelte';
    import { map } from '$lib/components/map/utils.svelte';
    import CustomControl from '$lib/components/map/custom-control/CustomControl.svelte';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import { Toggle } from '$lib/components/ui/toggle';
    import { PersonStanding, X } from '@lucide/svelte';
    import { MapillaryLayer } from './Mapillary';
    import { GoogleRedirect } from './Google';
    import { settings } from '$lib/logic/settings.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { onMount } from 'svelte';

    const { streetViewSource } = settings;

    let googleRedirect: GoogleRedirect | null = $state(null);
    let mapillaryLayer: MapillaryLayer | null = $state(null);
    let mapillaryOpen = $state({
        value: false,
    });
    let container: HTMLElement;

    onMount(() => {
        map.onLoad((map: mapboxgl.Map) => {
            googleRedirect = new GoogleRedirect(map);
            mapillaryLayer = new MapillaryLayer(map, container, mapillaryOpen);
        });
    });

    $effect(() => {
        if (streetViewSource.value === 'mapillary') {
            googleRedirect?.remove();
            if (streetViewEnabled.current) {
                mapillaryLayer?.add();
            } else {
                mapillaryLayer?.remove();
            }
        } else {
            mapillaryLayer?.remove();
            if (streetViewEnabled.current) {
                googleRedirect?.add();
            } else {
                googleRedirect?.remove();
            }
        }
    });
</script>

<CustomControl class="w-[29px] h-[29px] shrink-0">
    <Tooltip class="w-full h-full" side="left" label={i18n._('menu.toggle_street_view')}>
        <Toggle
            bind:pressed={streetViewEnabled.current}
            class="w-full h-full rounded p-0"
            aria-label={i18n._('menu.toggle_street_view')}
        >
            <PersonStanding size="22" />
        </Toggle>
    </Tooltip>
</CustomControl>

<div
    bind:this={container}
    class="{mapillaryOpen.value
        ? ''
        : 'hidden'} !absolute bottom-[44px] right-2.5 z-10 w-[40%] h-[40%] bg-background rounded-md overflow-hidden border-background border-2"
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="absolute top-0 right-0 z-10 bg-background p-1 rounded-bl-md cursor-pointer"
        onclick={() => {
            if (mapillaryLayer) {
                mapillaryLayer.closePopup();
            }
        }}
    >
        <X size="16" />
    </div>
</div>
