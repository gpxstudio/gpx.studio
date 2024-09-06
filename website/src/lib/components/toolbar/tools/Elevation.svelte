<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { selection } from '$lib/components/file-list/Selection';
    import Help from '$lib/components/Help.svelte';
    import { MountainSnow } from 'lucide-svelte';
    import { dbUtils } from '$lib/db';
    import { map } from '$lib/stores';
    import { _ } from 'svelte-i18n';

    $: validSelection = $selection.size > 0;
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {$$props.class ?? ''}">
    <Button
        variant="outline"
        class="whitespace-normal h-fit"
        disabled={!validSelection}
        on:click={async () => {
            if ($map) {
                dbUtils.addElevationToSelection($map);
            }
        }}
    >
        <MountainSnow size="16" class="mr-1 shrink-0" />
        {$_('toolbar.elevation.button')}
    </Button>
    <Help link="./help/toolbar/elevation">
        {#if validSelection}
            {$_('toolbar.elevation.help')}
        {:else}
            {$_('toolbar.elevation.help_no_selection')}
        {/if}
    </Help>
</div>
