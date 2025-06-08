<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Moon, Sun } from 'lucide-svelte';
    import { mode, setMode } from 'mode-watcher';
    import { _ } from '$lib/i18n';

    export let size = '20';
</script>

<Button
    variant="ghost"
    class="h-8 px-1.5 {$$props.class ?? ''}"
    on:click={() => {
        setMode(mode.current === 'light' ? 'dark' : 'light');
    }}
    aria-label={$_('menu.mode')}
>
    {#if mode.current === 'light'}
        <Sun {size} />
    {:else}
        <Moon {size} />
    {/if}
</Button>
