<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import Help from '$lib/components/Help.svelte';
    import { MountainSnow } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getElevation, getURLForLanguage } from '$lib/utils';
    import { engine } from '$lib/engine';
    import { get } from 'svelte/store';

    let props: {
        class?: string;
    } = $props();

    const statistics = engine.statistics;

    let validSelection = $derived($statistics.length > 0);

    async function addElevation() {
        const stats = get(statistics);
        const points = Array.from(stats.lng, (lng, i) => ({ lng, lat: stats.lat[i] }));
        const ele = await getElevation(points);

        // the selection or the files may have changed while the elevation was loading
        if (get(statistics) === stats) {
            await engine.setElevation(Float64Array.from(ele));
        }
    }
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <Button
        variant="outline"
        class="whitespace-normal h-fit min-h-8 py-1"
        disabled={!validSelection}
        onclick={() => addElevation()}
    >
        <MountainSnow size="16" class="shrink-0" />
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
