<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { selection } from '$lib/components/file-list/Selection';
    import Help from '$lib/components/Help.svelte';
    import { MountainSnow } from '@lucide/svelte';
    import { dbUtils } from '$lib/db';
    import { map } from '$lib/components/map/map.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';

    let props: {
        class?: string;
    } = $props();

    let validSelection = $derived($selection.size > 0);
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <Button
        variant="outline"
        class="whitespace-normal h-fit"
        disabled={!validSelection}
        onclick={async () => {
            if (map.current) {
                dbUtils.addElevationToSelection(map.current);
            }
        }}
    >
        <MountainSnow size="16" class="mr-1 shrink-0" />
        {i18n._('toolbar.elevation.button')}
    </Button>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/elevation')}>
        {#if validSelection}
            {i18n._('toolbar.elevation.help')}
        {:else}
            {i18n._('toolbar.elevation.help_no_selection')}
        {/if}
    </Help>
</div>
