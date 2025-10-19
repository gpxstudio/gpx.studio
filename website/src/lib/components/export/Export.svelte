<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Separator } from '$lib/components/ui/separator';
    import { Dialog } from 'bits-ui';
    import {
        exportAllFiles,
        exportSelectedFiles,
        ExportState,
        exportState,
    } from '$lib/components/export/utils.svelte';
    import { currentTool } from '$lib/components/toolbar/tools';
    import {
        Download,
        Zap,
        Earth,
        HeartPulse,
        Orbit,
        Thermometer,
        SquareActivity,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { GPXStatistics } from 'gpx';
    import { ListRootItem } from '$lib/components/file-list/file-list';
    import { fileStateCollection } from '$lib/logic/file-state';
    import { selection } from '$lib/logic/selection';
    import { gpxStatistics } from '$lib/logic/statistics';
    import { get } from 'svelte/store';

    let open = $derived(exportState.current !== ExportState.NONE);
    let exportOptions: Record<string, boolean> = $state({
        time: true,
        hr: true,
        cad: true,
        atemp: true,
        power: true,
        extensions: false,
    });
    let hide: Record<string, boolean> = $derived.by(() => {
        if (exportState.current === ExportState.NONE) {
            return {
                time: false,
                hr: false,
                cad: false,
                atemp: false,
                power: false,
                extensions: false,
            };
        } else {
            let statistics = $gpxStatistics;
            if (exportState.current === ExportState.ALL) {
                statistics = Array.from(get(fileStateCollection).values())
                    .map((file) => file.statistics)
                    .reduce((acc, cur) => {
                        if (cur !== undefined) {
                            acc.mergeWith(cur.getStatisticsFor(new ListRootItem()));
                        }
                        return acc;
                    }, new GPXStatistics());
            }
            return {
                time: statistics.global.time.total === 0,
                hr: statistics.global.hr.count === 0,
                cad: statistics.global.cad.count === 0,
                atemp: statistics.global.atemp.count === 0,
                power: statistics.global.power.count === 0,
                extensions: Object.keys(statistics.global.extensions).length === 0,
            };
        }
    });
    let exclude = $derived(Object.keys(exportOptions).filter((key) => !exportOptions[key]));

    $effect(() => {
        if (open) {
            currentTool.set(null);
        }
    });
</script>

<Dialog.Root
    bind:open
    onOpenChange={(isOpen) => {
        if (!isOpen) {
            exportState.current = ExportState.NONE;
        }
    }}
>
    <Dialog.Trigger class="hidden" />
    <Dialog.Portal>
        <Dialog.Content
            class="fixed left-[50%] top-[50%] z-50 w-fit max-w-full translate-x-[-50%] translate-y-[-50%] flex flex-col items-center gap-3 border bg-background p-3 shadow-lg rounded-md"
        >
            <div
                class="w-full flex flex-row items-center justify-center gap-4 border rounded-md p-2 bg-secondary"
            >
                <span>⚠️</span>
                <span class="max-w-[80%] text-sm">
                    {i18n._('menu.support_message')}
                </span>
            </div>
            <div class="w-full flex flex-row flex-wrap gap-2">
                <Button class="bg-support grow" href="https://ko-fi.com/gpxstudio" target="_blank">
                    {i18n._('menu.support_button')}
                    <span class="ml-2">🙏</span>
                </Button>
                <Button
                    variant="outline"
                    class="grow"
                    onclick={() => {
                        if (exportState.current === ExportState.SELECTION) {
                            exportSelectedFiles(exclude);
                        } else if (exportState.current === ExportState.ALL) {
                            exportAllFiles(exclude);
                        }
                        open = false;
                        exportState.current = ExportState.NONE;
                    }}
                >
                    <Download size="16" class="mr-1" />
                    {#if $fileStateCollection.size === 1 || (exportState.current === ExportState.SELECTION && $selection.size === 1)}
                        {i18n._('menu.download_file')}
                    {:else}
                        {i18n._('menu.download_files')}
                    {/if}
                </Button>
            </div>
            <div
                class="w-full max-w-xl flex flex-col items-center gap-2 {Object.values(hide).some(
                    (v) => !v
                )
                    ? ''
                    : 'hidden'}"
            >
                <div class="w-full flex flex-row items-center gap-3">
                    <div class="grow">
                        <Separator />
                    </div>
                    <Label class="shrink-0">
                        {i18n._('menu.export_options')}
                    </Label>
                    <div class="grow">
                        <Separator />
                    </div>
                </div>
                <div class="flex flex-row flex-wrap justify-center gap-x-6 gap-y-2">
                    <div class="flex flex-row items-center gap-1.5 {hide.time ? 'hidden' : ''}">
                        <Checkbox id="export-time" bind:checked={exportOptions.time} />
                        <Label for="export-time" class="flex flex-row items-center gap-1">
                            <Zap size="16" />
                            {i18n._('quantities.time')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-1.5 {hide.hr ? 'hidden' : ''}">
                        <Checkbox id="export-heartrate" bind:checked={exportOptions.hr} />
                        <Label for="export-heartrate" class="flex flex-row items-center gap-1">
                            <HeartPulse size="16" />
                            {i18n._('quantities.heartrate')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-1.5 {hide.cad ? 'hidden' : ''}">
                        <Checkbox id="export-cadence" bind:checked={exportOptions.cad} />
                        <Label for="export-cadence" class="flex flex-row items-center gap-1">
                            <Orbit size="16" />
                            {i18n._('quantities.cadence')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-1.5 {hide.atemp ? 'hidden' : ''}">
                        <Checkbox id="export-temperature" bind:checked={exportOptions.atemp} />
                        <Label for="export-temperature" class="flex flex-row items-center gap-1">
                            <Thermometer size="16" />
                            {i18n._('quantities.temperature')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-1.5 {hide.power ? 'hidden' : ''}">
                        <Checkbox id="export-power" bind:checked={exportOptions.power} />
                        <Label for="export-power" class="flex flex-row items-center gap-1">
                            <SquareActivity size="16" />
                            {i18n._('quantities.power')}
                        </Label>
                    </div>
                    <div
                        class="flex flex-row items-center gap-1.5 {hide.extensions ? 'hidden' : ''}"
                    >
                        <Checkbox id="export-extensions" bind:checked={exportOptions.extensions} />
                        <Label for="export-extensions" class="flex flex-row items-center gap-1">
                            <Earth size="16" />
                            {i18n._('quantities.osm_extensions')}
                        </Label>
                    </div>
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
