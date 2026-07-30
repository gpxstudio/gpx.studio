<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import Help from '$lib/components/Help.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { Magnet } from '@lucide/svelte';
    import { selection } from '$lib/logic/selection';
    import { fileActions } from '$lib/logic/file-actions';

    let props: { class?: string } = $props();

    let validSelection = $derived($selection.size > 0);
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <Button
        variant="outline"
        class="whitespace-normal h-fit min-h-8 py-1"
        disabled={!validSelection}
        onclick={() => fileActions.mapMatch()}
    >
        <Magnet size="16" class="shrink-0" />
        {i18n._('toolbar.map_matching.button')}
    </Button>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/elevation')}>
        {#if validSelection}
            {i18n._('toolbar.map_matching.help')}
        {:else}
            {i18n._('toolbar.map_matching.help_no_selection')}
        {/if}
    </Help>
</div>
