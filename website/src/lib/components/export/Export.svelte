<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Separator } from '$lib/components/ui/separator';
    import { Dialog } from 'bits-ui';
    import {
        allFileIds,
        exportAllFiles,
        exportSelectedFiles,
        selectedFileIds,
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
        Route,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { engine, type ExportOptions } from '$lib/engine';

    const selection = engine.selection;
    const order = engine.order;
    const files = engine.files;

    let open = $derived(exportState.current !== ExportState.NONE);
    let exportOptions: ExportOptions = $state({
        time: true,
        hr: true,
        cad: true,
        atemp: true,
        power: true,
        osm: false,
        asRoute: false,
    });
    // the files that are exported
    let fileIds: string[] = $derived.by(() => {
        // the selection and the order change with the files
        void $selection;
        void $order;
        void $files;
        if (exportState.current === ExportState.SELECTION) {
            return selectedFileIds();
        } else if (exportState.current === ExportState.ALL) {
            return allFileIds();
        }
        return [];
    });
    // the data that none of them has is not offered
    let hide: Record<keyof ExportOptions, boolean> = $derived.by(() => {
        const available = engine.exportableData(fileIds);
        return {
            time: !available.time,
            hr: !available.hr,
            cad: !available.cad,
            atemp: !available.atemp,
            power: !available.power,
            osm: !available.osm,
            // always possible
            asRoute: false,
        };
    });

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
                class="w-full flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 border rounded-md p-2 bg-secondary"
            >
                <span class="w-12 shrink-0 text-center text-xl">⚠️</span>
                <span class="text-sm">
                    {i18n._('menu.support_message')}
                </span>
            </div>
            <div class="w-full flex flex-row flex-wrap gap-2">
                <Button
                    class="bg-support grow"
                    href="https://opencollective.com/gpxstudio"
                    target="_blank"
                >
                    {i18n._('menu.support_button')}
                    <span>🙏</span>
                </Button>
                <Button
                    variant="outline"
                    class="grow"
                    onclick={() => {
                        // what is not offered is left out
                        const options = {
                            time: exportOptions.time && !hide.time,
                            hr: exportOptions.hr && !hide.hr,
                            cad: exportOptions.cad && !hide.cad,
                            atemp: exportOptions.atemp && !hide.atemp,
                            power: exportOptions.power && !hide.power,
                            osm: exportOptions.osm && !hide.osm,
                            asRoute: exportOptions.asRoute,
                        };
                        if (exportState.current === ExportState.SELECTION) {
                            exportSelectedFiles(options);
                        } else if (exportState.current === ExportState.ALL) {
                            exportAllFiles(options);
                        }
                        open = false;
                        exportState.current = ExportState.NONE;
                    }}
                >
                    <Download size="16" />
                    {#if fileIds.length === 1}
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
                    <div class="flex flex-row items-center gap-1.5 {hide.osm ? 'hidden' : ''}">
                        <Checkbox id="export-osm" bind:checked={exportOptions.osm} />
                        <Label for="export-osm" class="flex flex-row items-center gap-1">
                            <Earth size="16" />
                            {i18n._('quantities.osm_extensions')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-1.5">
                        <Checkbox id="export-as-route" bind:checked={exportOptions.asRoute} />
                        <Label for="export-as-route" class="flex flex-row items-center gap-1">
                            <Route size="16" />
                            {i18n._('menu.export_as_route', 'Export as route')}
                        </Label>
                    </div>
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
