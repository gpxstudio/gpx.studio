<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { i18n } from '$lib/i18n.svelte';
    import { page } from '$app/state';
    import { map } from '$lib/components/map/map';
    import { PUBLIC_MAPTILER_KEY } from '$env/static/public';

    let {
        maptilerKey = PUBLIC_MAPTILER_KEY,
        geolocate = true,
        geocoder = true,
        hash = true,
        class: className = '',
    }: {
        maptilerKey?: string;
        geolocate?: boolean;
        geocoder?: boolean;
        hash?: boolean;
        class?: string;
    } = $props();

    let webgl2Supported = $state(true);
    let embeddedApp = $state(false);

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

        map.init(maptilerKey, language, hash, geocoder, geolocate);
    });

    onDestroy(() => {
        map.destroy();
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

    div :global(.maplibregl-map) {
        @apply font-sans;
    }

    div :global(.maplibregl-ctrl-top-right > .maplibregl-ctrl) {
        @apply shadow-md;
        @apply bg-background;
        @apply text-foreground;
    }

    div :global(.maplibregl-ctrl-icon) {
        @apply dark:brightness-[4.7];
    }

    div :global(.maplibregl-ctrl-geocoder) {
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

    div :global(.maplibregl-ctrl-geocoder .suggestions > li > a) {
        @apply text-foreground;
        @apply hover:text-accent-foreground;
        @apply hover:bg-accent;
    }

    div :global(.maplibregl-ctrl-geocoder .suggestions > .active > a) {
        @apply bg-background;
    }

    div :global(.maplibregl-ctrl-geocoder--button) {
        @apply bg-transparent;
        @apply hover:bg-transparent;
    }

    div :global(.maplibregl-ctrl-geocoder--icon) {
        @apply fill-foreground;
        @apply hover:fill-accent-foreground;
    }

    div :global(.maplibregl-ctrl-geocoder--icon-search) {
        @apply relative;
        @apply top-0;
        @apply left-0;
        @apply my-2;
        @apply w-[29px];
    }

    div :global(.maplibregl-ctrl-geocoder--input) {
        @apply relative;
        @apply w-64;
        @apply py-0;
        @apply pl-2;
        @apply focus:outline-none;
        @apply transition-[width];
        @apply duration-200;
        @apply text-foreground;
    }

    div :global(.maplibregl-ctrl-geocoder--collapsed .maplibregl-ctrl-geocoder--input) {
        @apply w-0;
        @apply p-0;
    }

    div :global(.maplibregl-ctrl-top-right) {
        @apply z-40;
        @apply flex;
        @apply flex-col;
        @apply items-end;
        @apply h-full;
        @apply overflow-hidden;
    }

    .horizontal :global(.maplibregl-ctrl-bottom-left) {
        @apply bottom-[42px];
    }

    .horizontal :global(.maplibregl-ctrl-bottom-right) {
        @apply bottom-[42px];
    }

    div :global(.maplibregl-ctrl-attrib) {
        @apply dark:bg-transparent;
    }

    div :global(.maplibregl-compact-show.maplibregl-ctrl-attrib) {
        @apply dark:bg-background;
    }

    div :global(.maplibregl-ctrl-attrib-button) {
        @apply dark:bg-foreground;
    }

    div :global(.maplibregl-compact-show .maplibregl-ctrl-attrib-button) {
        @apply dark:bg-foreground;
    }

    div :global(.maplibregl-ctrl-attrib a) {
        @apply text-foreground;
    }

    div :global(.maplibregl-popup) {
        @apply z-50;
    }

    div :global(.maplibregl-popup-content) {
        @apply p-0;
        @apply bg-transparent;
        @apply shadow-none;
    }

    div :global(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
        @apply border-b-background;
    }

    div :global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip) {
        @apply border-b-background;
    }

    div :global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
        @apply border-b-background;
    }

    div :global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
        @apply border-t-background;
        @apply drop-shadow-md;
    }

    div :global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip) {
        @apply border-t-background;
        @apply drop-shadow-md;
    }

    div :global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
        @apply border-t-background;
        @apply drop-shadow-md;
    }

    div :global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
        @apply border-r-background;
    }

    div :global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
        @apply border-l-background;
    }
</style>
