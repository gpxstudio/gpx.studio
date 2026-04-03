<script lang="ts">
    import maplibregl from 'maplibre-gl';
    import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';
    import { streetViewEnabled } from '$lib/components/map/street-view-control/utils';
    import { map } from '$lib/components/map/map';
    import CustomControl from '$lib/components/map/custom-control/CustomControl.svelte';
    import { PersonStanding, X } from '@lucide/svelte';
    import { MapillaryLayer } from './mapillary';
    import { GoogleRedirect } from './google';
    import GoogleStreetViewModal from './GoogleStreetViewModal.svelte';
    import { settings } from '$lib/logic/settings';
    import { i18n } from '$lib/i18n.svelte';
    import { onMount } from 'svelte';
    import ButtonWithTooltip from '$lib/components/ButtonWithTooltip.svelte';

    const { streetViewSource } = settings;
    const hasGoogleMapsApiKey =
        PUBLIC_GOOGLE_MAPS_API_KEY !== '' &&
        PUBLIC_GOOGLE_MAPS_API_KEY !== 'YOUR_GOOGLE_MAP_API_KEY_HERE';

    let googleRedirect: GoogleRedirect | null = $state(null);
    let mapillaryLayer: MapillaryLayer | null = $state(null);
    let mapillaryOpen = $state({
        value: false,
    });
    let googleModalOpen = $state({ value: false });
    let selectedLat = $state(0);
    let selectedLng = $state(0);
    let container: HTMLElement;

    function handleGoogleLocationClick(lat: number, lng: number) {
        selectedLat = lat;
        selectedLng = lng;
        googleModalOpen.value = true;
    }

    onMount(() => {
        map.onLoad((map_: maplibregl.Map) => {
            googleRedirect = new GoogleRedirect(
                map_,
                hasGoogleMapsApiKey ? handleGoogleLocationClick : undefined
            );
            mapillaryLayer = new MapillaryLayer(
                map_,
                map.layerEventManager!,
                container,
                mapillaryOpen
            );
        });
    });

    $effect(() => {
        if ($streetViewSource === 'mapillary') {
            googleRedirect?.remove();
            if ($streetViewEnabled) {
                mapillaryLayer?.add();
            } else {
                mapillaryLayer?.remove();
            }
        } else {
            mapillaryLayer?.remove();
            if ($streetViewEnabled) {
                googleRedirect?.add();
            } else {
                googleRedirect?.remove();
            }
        }
    });

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && $streetViewEnabled) {
            if (!googleModalOpen.value && !mapillaryOpen.value) {
                $streetViewEnabled = false;
            }
        }
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<CustomControl class="w-[29px] h-[29px] shrink-0">
    <ButtonWithTooltip
        variant="ghost"
        class="w-full h-full"
        side="left"
        label={i18n._('menu.toggle_street_view')}
        onclick={() => {
            $streetViewEnabled = !$streetViewEnabled;
        }}
    >
        <PersonStanding
            size="22"
            class="size-5.5"
            color={$streetViewEnabled ? '#33b5e5' : 'currentColor'}
        />
    </ButtonWithTooltip>
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

<GoogleStreetViewModal isOpen={googleModalOpen} lat={selectedLat} lng={selectedLng} />
