<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import Tooltip from '$lib/components/Tooltip.svelte';
    import WithUnits from '$lib/components/WithUnits.svelte';

    import { MoveDownRight, MoveUpRight, Ruler, Timer, Zap } from 'lucide-svelte';

    import { _ } from 'svelte-i18n';
    import type { GPXStatistics } from 'gpx';
    import type { Writable } from 'svelte/store';
    import { settings } from '$lib/db';

    export let gpxStatistics: Writable<GPXStatistics>;
    export let slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined>;
    export let orientation: 'horizontal' | 'vertical';
    export let panelSize: number;

    const { velocityUnits } = settings;

    let statistics: GPXStatistics;

    $: if ($slicedGPXStatistics !== undefined) {
        statistics = $slicedGPXStatistics[0];
    } else {
        statistics = $gpxStatistics;
    }
</script>

<Card.Root
    class="h-full {orientation === 'vertical'
        ? 'min-w-44 sm:min-w-52 text-sm sm:text-base'
        : 'w-full'} border-none shadow-none"
>
    <Card.Content
        class="h-full flex {orientation === 'vertical'
            ? 'flex-col justify-center'
            : 'flex-row w-full justify-between'} gap-4  p-0"
    >
        <Tooltip>
            <span slot="data" class="flex flex-row items-center">
                <Ruler size="18" class="mr-1" />
                <WithUnits value={statistics.global.distance.total} type="distance" />
            </span>
            <span slot="tooltip">{$_('quantities.distance')}</span>
        </Tooltip>
        <Tooltip>
            <span slot="data" class="flex flex-row items-center">
                <MoveUpRight size="18" class="mr-1" />
                <WithUnits value={statistics.global.elevation.gain} type="elevation" />
                <MoveDownRight size="18" class="mx-1" />
                <WithUnits value={statistics.global.elevation.loss} type="elevation" />
            </span>
            <span slot="tooltip">{$_('quantities.elevation_gain_loss')}</span>
        </Tooltip>
        {#if panelSize > 120 || orientation === 'horizontal'}
            <Tooltip class={orientation === 'horizontal' ? 'hidden xs:block' : ''}>
                <span slot="data" class="flex flex-row items-center">
                    <Zap size="18" class="mr-1" />
                    <WithUnits
                        value={statistics.global.speed.moving}
                        type="speed"
                        showUnits={false}
                    />
                    <span class="mx-1">/</span>
                    <WithUnits value={statistics.global.speed.total} type="speed" />
                </span>
                <span slot="tooltip"
                    >{$velocityUnits === 'speed' ? $_('quantities.speed') : $_('quantities.pace')} ({$_(
                        'quantities.moving'
                    )} / {$_('quantities.total')})</span
                >
            </Tooltip>
        {/if}
        {#if panelSize > 160 || orientation === 'horizontal'}
            <Tooltip class={orientation === 'horizontal' ? 'hidden md:block' : ''}>
                <span slot="data" class="flex flex-row items-center">
                    <Timer size="18" class="mr-1" />
                    <WithUnits value={statistics.global.time.moving} type="time" />
                    <span class="mx-1">/</span>
                    <WithUnits value={statistics.global.time.total} type="time" />
                </span>
                <span slot="tooltip"
                    >{$_('quantities.time')} ({$_('quantities.moving')} / {$_(
                        'quantities.total'
                    )})</span
                >
            </Tooltip>
        {/if}
    </Card.Content>
</Card.Root>
