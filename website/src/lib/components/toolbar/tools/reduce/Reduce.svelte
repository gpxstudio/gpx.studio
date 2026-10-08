<script lang="ts">
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import { Slider } from '$lib/components/ui/slider';
    import Help from '$lib/components/Help.svelte';
    import { Funnel } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import WithUnits from '$lib/components/WithUnits.svelte';
    import { onDestroy } from 'svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { engine } from '$lib/engine';
    import { minTolerance, ReducedLayer, tolerance } from './utils.svelte';

    let props: { class?: string } = $props();

    let sliderValue = $state(50);
    const maxTolerance = 10000;

    const selection = engine.selection;
    const statistics = engine.statistics;

    // the preview needs the start of each segment
    const request = engine.requestStatistics();
    request.set(['anchors']);

    let validSelection = $derived(
        $selection.type === 'file' || $selection.type === 'track' || $selection.type === 'segment'
    );

    let reducedLayer = new ReducedLayer();

    $effect(() => {
        // recomputed when the selection or the files change
        const stats = $statistics;
        const distances = engine.reductionDistances();
        reducedLayer.update(stats, distances, $tolerance);
    });

    $effect(() => {
        tolerance.set(
            minTolerance * 2 ** (sliderValue / (100 / Math.log2(maxTolerance / minTolerance)))
        );
    });

    onDestroy(() => {
        request.release();
        reducedLayer.destroy();
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <div class="p-2">
        <Slider bind:value={sliderValue} min={0} max={100} step={1} type="single" />
    </div>
    <Label class="flex flex-row justify-between">
        <span>{i18n._('toolbar.reduce.tolerance')}</span>
        <WithUnits value={$tolerance / 1000} type="distance" decimals={4} class="font-normal" />
    </Label>
    <Label class="flex flex-row justify-between">
        <span>{i18n._('toolbar.reduce.number_of_points')}</span>
        <span class="font-normal">{reducedLayer.currentPoints}/{reducedLayer.maxPoints}</span>
    </Label>
    <Button variant="outline" disabled={!validSelection} onclick={() => engine.reduce($tolerance)}>
        <Funnel size="16" />
        {i18n._('toolbar.reduce.button')}
    </Button>

    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/minify')}>
        {#if validSelection}
            {i18n._('toolbar.reduce.help')}
        {:else}
            {i18n._('toolbar.reduce.help_no_selection')}
        {/if}
    </Help>
</div>
