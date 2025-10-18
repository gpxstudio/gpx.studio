<script lang="ts">
    import { isMac, isSafari } from '$lib/utils';
    import { onMount } from 'svelte';
    import { i18n } from '$lib/i18n.svelte';
    import * as Kbd from '$lib/components/ui/kbd/index.js';

    let {
        key = undefined,
        shift = false,
        ctrl = false,
        click = false,
        class: className = '',
    }: {
        key?: string;
        shift?: boolean;
        ctrl?: boolean;
        click?: boolean;
        class?: string;
    } = $props();

    let mac = $state(false);
    let safari = $state(false);

    onMount(() => {
        mac = isMac();
        safari = isSafari();
    });
</script>

<Kbd.Root class="ml-auto {className}">
    {#if shift}
        ⇧
    {/if}
    {#if ctrl}
        {mac && !safari ? '⌘' : i18n._('menu.ctrl')}
    {/if}
    {#if key}
        {key}
    {/if}
    {#if click}
        {i18n._('menu.click')}
    {/if}
</Kbd.Root>
