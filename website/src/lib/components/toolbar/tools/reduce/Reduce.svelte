<script lang="ts">
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button';
    import { Slider } from '$lib/components/ui/slider';
    import { ListRootItem } from '$lib/components/file-list/file-list';
    import Help from '$lib/components/Help.svelte';
    import { Funnel } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import WithUnits from '$lib/components/WithUnits.svelte';
    import { onDestroy } from 'svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { selection } from '$lib/logic/selection';
    import { minTolerance, ReducedGPXLayerCollection, tolerance } from './utils.svelte';

    let props: { class?: string } = $props();

    let sliderValue = $state([50]);
    const maxTolerance = 10000;

    let validSelection = $derived(
        $selection.hasAnyChildren(new ListRootItem(), true, ['waypoints'])
    );

    let reducedLayers = new ReducedGPXLayerCollection();

    $effect(() => {
        tolerance.set(
            minTolerance * 2 ** (sliderValue[0] / (100 / Math.log2(maxTolerance / minTolerance)))
        );
    });

    onDestroy(() => {
        reducedLayers.destroy();
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <div class="p-2">
        <Slider bind:value={sliderValue} min={0} max={100} step={1} type="multiple" />
    </div>
    <Label class="flex flex-row justify-between">
        <span>{i18n._('toolbar.reduce.tolerance')}</span>
        <WithUnits value={$tolerance / 1000} type="distance" decimals={4} class="font-normal" />
    </Label>
    <Label class="flex flex-row justify-between">
        <span>{i18n._('toolbar.reduce.number_of_points')}</span>
        <span class="font-normal">{reducedLayers.currentPoints}/{reducedLayers.maxPoints}</span>
    </Label>
    <Button variant="outline" disabled={!validSelection} onclick={() => reducedLayers.reduce()}>
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
