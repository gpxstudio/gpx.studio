<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Moon, Sun } from '@lucide/svelte';
    import { mode, setMode } from 'mode-watcher';
    import { i18n } from '$lib/i18n.svelte';
</script>

<Button
    variant="ghost"
    size="icon"
    onclick={() => {
        setMode(mode.current === 'light' ? 'dark' : 'light');
    }}
    aria-label={i18n._('menu.mode')}
>
    {#if mode.current === 'light'}
        <Sun />
    {:else}
        <Moon />
    {/if}
</Button>
