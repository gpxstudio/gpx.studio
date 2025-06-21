<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import 'mapbox-gl/dist/mapbox-gl.css';
    import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
    import { Button } from '$lib/components/ui/button';
    import { settings } from '$lib/logic/settings.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
    import { page } from '$app/state';
    import { map } from '$lib/components/map/utils.svelte';

    let {
        accessToken = PUBLIC_MAPBOX_TOKEN,
        geolocate = true,
        geocoder = true,
        hash = true,
        class: className = '',
    }: {
        accessToken?: string;
        geolocate?: boolean;
        geocoder?: boolean;
        hash?: boolean;
        class?: string;
    } = $props();

    mapboxgl.accessToken = accessToken;

    let webgl2Supported = $state(true);
    let embeddedApp = $state(false);

    const { distanceUnits, elevationProfile, treeFileView, bottomPanelSize, rightPanelSize } =
        settings;

    onMount(() => {
        let gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) {
            webgl2Supported = false;
            return;
        }
        if (window.top !== window.self && !page.route.id?.includes('embed')) {
            embeddedApp = true;
            return;
        }

        let language = page.params.language;
        if (language === 'zh') {
            language = 'zh-Hans';
        } else if (language?.includes('-')) {
            language = language.split('-')[0];
        } else if (language === '' || language === undefined) {
            language = 'en';
        }

        map.init(PUBLIC_MAPBOX_TOKEN, language, distanceUnits.value, hash, geocoder, geolocate);
    });

    onDestroy(() => {
        map.destroy();
    });

    $effect(() => {
        if (
            !treeFileView.value ||
            !elevationProfile.value ||
            bottomPanelSize.value ||
            rightPanelSize.value
        ) {
            map.resize();
        }
    });
</script>

<div class={className}>
    <div id="map" class="h-full {webgl2Supported && !embeddedApp ? '' : 'hidden'}"></div>
    <div
        class="flex flex-col items-center justify-center gap-3 h-full {webgl2Supported &&
        !embeddedApp
            ? 'hidden'
            : ''} {embeddedApp ? 'z-30' : ''}"
    >
        {#if !webgl2Supported}
            <p>{i18n._('webgl2_required')}</p>
            <Button href="https://get.webgl.org/webgl2/" target="_blank">
                {i18n._('enable_webgl2')}
            </Button>
        {:else if embeddedApp}
            <p>The app cannot be embedded in an iframe.</p>
            <Button href="https://gpx.studio/help/integration" target="_blank">
                Learn how to create a map for your website
            </Button>
        {/if}
    </div>
</div>

<style lang="postcss">
    @reference "../../../app.css";

    div :global(.mapboxgl-map) {
        @apply font-sans;
    }

    div :global(.mapboxgl-ctrl-top-right > .mapboxgl-ctrl) {
        @apply shadow-md;
        @apply bg-background;
        @apply text-foreground;
    }

    div :global(.mapboxgl-ctrl-icon) {
        @apply dark:brightness-[4.7];
    }

    div :global(.mapboxgl-ctrl-geocoder) {
        @apply flex;
        @apply flex-row;
        @apply w-fit;
        @apply min-w-fit;
        @apply items-center;
        @apply shadow-md;
    }

    div :global(.suggestions) {
        @apply shadow-md;
        @apply bg-background;
        @apply text-foreground;
    }

    div :global(.mapboxgl-ctrl-geocoder .suggestions > li > a) {
        @apply text-foreground;
        @apply hover:text-accent-foreground;
        @apply hover:bg-accent;
    }

    div :global(.mapboxgl-ctrl-geocoder .suggestions > .active > a) {
        @apply bg-background;
    }

    div :global(.mapboxgl-ctrl-geocoder--button) {
        @apply bg-transparent;
        @apply hover:bg-transparent;
    }

    div :global(.mapboxgl-ctrl-geocoder--icon) {
        @apply fill-foreground;
        @apply hover:fill-accent-foreground;
    }

    div :global(.mapboxgl-ctrl-geocoder--icon-search) {
        @apply relative;
        @apply top-0;
        @apply left-0;
        @apply my-2;
        @apply w-[29px];
    }

    div :global(.mapboxgl-ctrl-geocoder--input) {
        @apply relative;
        @apply w-64;
        @apply py-0;
        @apply pl-2;
        @apply focus:outline-none;
        @apply transition-[width];
        @apply duration-200;
        @apply text-foreground;
    }

    div :global(.mapboxgl-ctrl-geocoder--collapsed .mapboxgl-ctrl-geocoder--input) {
        @apply w-0;
        @apply p-0;
    }

    div :global(.mapboxgl-ctrl-top-right) {
        @apply z-40;
        @apply flex;
        @apply flex-col;
        @apply items-end;
        @apply h-full;
        @apply overflow-hidden;
    }

    .horizontal :global(.mapboxgl-ctrl-bottom-left) {
        @apply bottom-[42px];
    }

    .horizontal :global(.mapboxgl-ctrl-bottom-right) {
        @apply bottom-[42px];
    }

    div :global(.mapboxgl-ctrl-attrib) {
        @apply dark:bg-transparent;
    }

    div :global(.mapboxgl-compact-show.mapboxgl-ctrl-attrib) {
        @apply dark:bg-background;
    }

    div :global(.mapboxgl-ctrl-attrib-button) {
        @apply dark:bg-foreground;
    }

    div :global(.mapboxgl-compact-show .mapboxgl-ctrl-attrib-button) {
        @apply dark:bg-foreground;
    }

    div :global(.mapboxgl-ctrl-attrib a) {
        @apply text-foreground;
    }

    div :global(.mapboxgl-popup) {
        @apply w-fit;
        @apply z-50;
    }

    div :global(.mapboxgl-popup-content) {
        @apply p-0;
        @apply bg-transparent;
        @apply shadow-none;
    }

    div :global(.mapboxgl-popup-anchor-top .mapboxgl-popup-tip) {
        @apply border-b-background;
    }

    div :global(.mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip) {
        @apply border-b-background;
    }

    div :global(.mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip) {
        @apply border-b-background;
    }

    div :global(.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip) {
        @apply border-t-background;
        @apply drop-shadow-md;
    }

    div :global(.mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip) {
        @apply border-t-background;
        @apply drop-shadow-md;
    }

    div :global(.mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip) {
        @apply border-t-background;
        @apply drop-shadow-md;
    }

    div :global(.mapboxgl-popup-anchor-left .mapboxgl-popup-tip) {
        @apply border-r-background;
    }

    div :global(.mapboxgl-popup-anchor-right .mapboxgl-popup-tip) {
        @apply border-l-background;
    }
</style>
