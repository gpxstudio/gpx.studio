<script lang="ts">
    import { X } from '@lucide/svelte';
    import { onDestroy, onMount } from 'svelte';

    import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';
    import { streetViewEnabled } from '$lib/components/map/street-view-control/utils';

    interface Props {
        isOpen: { value: boolean };
        lat: number;
        lng: number;
    }

    let { isOpen, lat, lng }: Props = $props();

    let iframeElement = $state<HTMLIFrameElement>();
    let focusCatcherElement = $state<HTMLDivElement>();
    let checkFocusInterval: number | undefined;

    const streetViewUrl = $derived(
        `https://www.google.com/maps/embed/v1/streetview?key=${PUBLIC_GOOGLE_MAPS_API_KEY}&location=${lat},${lng}&heading=0&pitch=0&fov=90`
    );

    function closeModal() {
        isOpen.value = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && isOpen.value) {
            closeModal();
        }
    }

    $effect(() => {
        if (!$streetViewEnabled && isOpen.value) {
            closeModal();
        }
    });

    onMount(() => {
        checkFocusInterval = window.setInterval(() => {
            if (isOpen.value && document.activeElement === iframeElement) {
                focusCatcherElement?.focus();
            }
        }, 500);

        return () => {
            if (checkFocusInterval !== undefined) {
                clearInterval(checkFocusInterval);
            }
        };
    });

    onDestroy(() => {
        if (checkFocusInterval !== undefined) {
            clearInterval(checkFocusInterval);
        }
    });
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen.value}
    <div class="fixed inset-0 z-50 h-full w-full overflow-hidden bg-background">
        <div class="absolute right-2 top-2 z-10 rounded-md bg-background/90">
            <button
                onclick={closeModal}
                class="rounded-md p-2 transition-colors hover:bg-accent"
                aria-label="Close Street View"
            >
                <X size="26" />
            </button>
        </div>

        <iframe
            bind:this={iframeElement}
            title="Google Street View"
            width="100%"
            height="100%"
            style="border:0"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            src={streetViewUrl}
        ></iframe>

        <div
            bind:this={focusCatcherElement}
            tabindex="-1"
            style="position: fixed; opacity: 0; pointer-events: none;"
            aria-hidden="true"
        ></div>
    </div>
{/if}
