<script lang="ts">
    import { browser } from '$app/environment';
    import { extensionAPI } from '$lib/components/map/layer-control/extension-api';
    import type { Snippet } from 'svelte';

    let { children }: { children: Snippet } = $props();

    if (browser) {
        extensionAPI.init();
    }
</script>

{@render children()}
