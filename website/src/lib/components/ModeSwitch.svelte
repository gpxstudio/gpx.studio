<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Moon, Sun } from '@lucide/svelte';
    import { mode, setMode } from 'mode-watcher';
    import { i18n } from '$lib/i18n.svelte';

    export let size = '20';
</script>

<Button
    variant="ghost"
    size="icon"
    class="h-8 px-1.5 {$$props.class ?? ''}"
    onclick={() => {
        setMode(mode.current === 'light' ? 'dark' : 'light');
    }}
    aria-label={i18n._('menu.mode')}
>
    {#if mode.current === 'light'}
        <Sun {size} />
    {:else}
        <Moon {size} />
    {/if}
</Button>
