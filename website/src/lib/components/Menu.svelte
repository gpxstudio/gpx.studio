<script lang="ts">
    import * as Menubar from '$lib/components/ui/menubar/index.js';
    import { Button } from '$lib/components/ui/button';
    import Logo from '$lib/components/Logo.svelte';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import { toast } from 'svelte-sonner';
    import {
        Plus,
        Copy,
        Download,
        Upload,
        Undo2,
        Redo2,
        Trash2,
        Heart,
        Map,
        Layers2,
        Box,
        Milestone,
        Coins,
        Ruler,
        Zap,
        Thermometer,
        Sun,
        Moon,
        Layers,
        ListTree,
        Languages,
        Settings,
        Info,
        File,
        View,
        FilePen,
        HeartHandshake,
        PersonStanding,
        Eye,
        EyeOff,
        ClipboardCopy,
        Scissors,
        ClipboardPaste,
        PaintBucket,
        FolderOpen,
        FileStack,
        FileX,
        BookOpenText,
        ChartArea,
        Maximize,
    } from '@lucide/svelte';
    import { map } from '$lib/components/map/map';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { exportState, ExportState } from '$lib/components/export/utils.svelte';
    import { anySelectedLayer } from '$lib/components/map/layer-control/utils';
    import { defaultOverlays, type CustomLayer } from '$lib/assets/layers';
    import LayerControlSettings from '$lib/components/map/layer-control/LayerControlSettings.svelte';
    import { ListFileItem, ListTrackItem } from '$lib/components/file-list/file-list';
    import Export from '$lib/components/export/Export.svelte';
    import { mode, setMode } from 'mode-watcher';
    import { i18n } from '$lib/i18n.svelte';
    import { languages } from '$lib/languages';
    import { getURLForLanguage } from '$lib/utils';
    import { get } from 'svelte/store';
    import { settings } from '$lib/logic/settings';
    import {
        createFile,
        fileActions,
        loadFiles,
        pasteSelection,
        triggerFileInput,
    } from '$lib/logic/file-actions';
    import { fileStateCollection } from '$lib/logic/file-state';
    import { fileActionManager } from '$lib/logic/file-action-manager';
    import { copied, selection } from '$lib/logic/selection';
    import { allHidden } from '$lib/logic/hidden';
    import { boundsManager } from '$lib/logic/bounds';
    import { tick } from 'svelte';
    import { allowedPastes } from '$lib/components/file-list/sortable-file-list';

    const {
        distanceUnits,
        velocityUnits,
        temperatureUnits,
        elevationProfile,
        treeFileView,
        currentBasemap,
        previousBasemap,
        currentOverlays,
        previousOverlays,
        distanceMarkers,
        directionMarkers,
        streetViewSource,
        routing,
    } = settings;

    const canUndo = fileActionManager.canUndo;
    const canRedo = fileActionManager.canRedo;

    function switchBasemaps() {
        [$currentBasemap, $previousBasemap] = [$previousBasemap, $currentBasemap];
    }

    function toggleOverlays() {
        if ($currentOverlays && anySelectedLayer($currentOverlays)) {
            [$currentOverlays, $previousOverlays] = [defaultOverlays, $currentOverlays];
        } else {
            [$currentOverlays, $previousOverlays] = [$previousOverlays, defaultOverlays];
        }
    }

    let layerSettingsOpen = $state(false);
    function exportSettings() {
        try {
            const settingsData: Record<string, any> = {
                version: 1,
                timestamp: new Date().toISOString(),
                settings: {},
            };

            settingsData.settings.additionalDatasets = get(settings.additionalDatasets);
            settingsData.settings.defaultOpacity = get(settings.defaultOpacity);
            settingsData.settings.defaultWidth = get(settings.defaultWidth);
            settingsData.settings.directionMarkers = get(settings.directionMarkers);
            settingsData.settings.distanceMarkers = get(settings.distanceMarkers);
            settingsData.settings.distanceUnits = get(settings.distanceUnits);
            settingsData.settings.elevationFill = get(settings.elevationFill);
            settingsData.settings.opacities = get(settings.opacities);
            settingsData.settings.privateRoads = get(settings.privateRoads);
            settingsData.settings.routing = get(settings.routing);
            settingsData.settings.routingProfile = get(settings.routingProfile);
            settingsData.settings.streetViewSource = get(settings.streetViewSource);
            settingsData.settings.temperatureUnits = get(settings.temperatureUnits);
            settingsData.settings.velocityUnits = get(settings.velocityUnits);

            settingsData.settings.selectedBasemapTree = get(settings.selectedBasemapTree);
            settingsData.settings.selectedOverlayTree = get(settings.selectedOverlayTree);
            settingsData.settings.selectedOverpassTree = get(settings.selectedOverpassTree);
            // import will handle custom layers separately
            delete settingsData.settings.selectedBasemapTree.basemaps.custom;
            delete settingsData.settings.selectedOverlayTree.overlays.custom;

            settingsData.settings.customLayers = get(settings.customLayers);

            const json = JSON.stringify(settingsData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            link.download = `gpx-studio-settings-${timestamp}.json`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            toast.success(i18n._('menu.settings_export.success'));
        } catch (error) {
            console.error('Export settings failed:', error);
            toast.error(i18n._('menu.settings_export.error'));
        }
    }

    function importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.className = 'hidden';
        input.onchange = async (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.version || !data.settings) {
                    throw new Error('Invalid settings file format');
                }

                if (data.settings.distanceUnits !== undefined) {
                    distanceUnits.set(data.settings.distanceUnits);
                }
                if (data.settings.velocityUnits !== undefined) {
                    velocityUnits.set(data.settings.velocityUnits);
                }
                if (data.settings.temperatureUnits !== undefined) {
                    temperatureUnits.set(data.settings.temperatureUnits);
                }
                if (data.settings.additionalDatasets !== undefined) {
                    settings.additionalDatasets.set(data.settings.additionalDatasets);
                }
                if (data.settings.elevationFill !== undefined) {
                    settings.elevationFill.set(data.settings.elevationFill);
                }
                if (data.settings.routing !== undefined) {
                    settings.routing.set(data.settings.routing);
                }
                if (data.settings.routingProfile !== undefined) {
                    settings.routingProfile.set(data.settings.routingProfile);
                }
                if (data.settings.privateRoads !== undefined) {
                    settings.privateRoads.set(data.settings.privateRoads);
                }
                if (data.settings.opacities !== undefined) {
                    settings.opacities.set(data.settings.opacities);
                }
                if (data.settings.directionMarkers !== undefined) {
                    directionMarkers.set(data.settings.directionMarkers);
                }
                if (data.settings.distanceMarkers !== undefined) {
                    distanceMarkers.set(data.settings.distanceMarkers);
                }
                if (data.settings.streetViewSource !== undefined) {
                    streetViewSource.set(data.settings.streetViewSource);
                }
                if (data.settings.defaultOpacity !== undefined) {
                    settings.defaultOpacity.set(data.settings.defaultOpacity);
                }
                if (data.settings.defaultWidth !== undefined) {
                    settings.defaultWidth.set(data.settings.defaultWidth);
                }
                if (data.settings.selectedOverpassTree !== undefined) {
                    settings.selectedOverpassTree.set(data.settings.selectedOverpassTree);
                }
                let selectedBasemapTree = get(settings.selectedBasemapTree);
                if (data.settings.selectedBasemapTree !== undefined) {
                    settings.selectedBasemapTree.set(data.settings.selectedBasemapTree);
                    selectedBasemapTree = data.settings.selectedBasemapTree;
                }
                let selectedOverlayTree = get(settings.selectedOverlayTree);
                if (data.settings.selectedOverlayTree !== undefined) {
                    settings.selectedOverlayTree.set(data.settings.selectedOverlayTree);
                    selectedOverlayTree = data.settings.selectedOverlayTree;
                }
                let customLayers = get(settings.customLayers);
                if (data.settings.customLayers !== undefined) {
                    // Special handling to avoid overwriting existing custom layers
                    // instead only add new ones and try to avoid duplicates
                    const duplicationKey = (l: CustomLayer) =>
                        String(l.layerType) + String(l.name) + l.tileUrls.sort().join(',');

                    const existingsLayers = new Set();
                    for (const l of Object.values(get(settings.customLayers))) {
                        existingsLayers.add(duplicationKey(l));
                    }

                    const newLayers: Record<string, CustomLayer> = {};
                    for (const l of Object.values(data.settings.customLayers) as CustomLayer[]) {
                        const key = duplicationKey(l);
                        if (!existingsLayers.has(key)) {
                            const id = `custom-${Object.keys(newLayers).length + Object.keys(get(settings.customLayers)).length}`;
                            l.id = id;
                            newLayers[id] = l;
                        }
                    }
                    console.log('New custom layers to add:', newLayers);

                    if (Object.keys(newLayers).length > 0) {
                        customLayers = {
                            ...get(settings.customLayers),
                            ...newLayers,
                        };
                        settings.customLayers.set(customLayers);
                    }
                }

                // assign new IDs to avoid conflicts
                const customBaseTree: Record<string, boolean> = {};
                const customOverlayTree: Record<string, boolean> = {};

                for (const layer of Object.values(customLayers) as CustomLayer[]) {
                    if (layer.layerType === 'basemap') {
                        customBaseTree[layer.id] = true;
                    } else {
                        customOverlayTree[layer.id] = true;
                    }
                }
                (selectedBasemapTree.basemaps as any).custom = customBaseTree;
                settings.selectedBasemapTree.set(selectedBasemapTree);

                (selectedOverlayTree.overlays as any).custom = customOverlayTree;
                settings.selectedOverlayTree.set(selectedOverlayTree);

                toast.success(i18n._('menu.settings_export.import_success'));
            } catch (error) {
                console.error('Import settings failed:', error);
                toast.error(i18n._('menu.settings_export.import_error'));
            } finally {
                target.value = '';
            }
        };
        input.click();
    }
</script>

<div class="absolute md:top-2 left-0 right-0 z-20 flex flex-row justify-center pointer-events-none">
    <div
        class="w-fit flex flex-row items-center justify-center p-1 bg-background rounded-b-md md:rounded-md pointer-events-auto shadow-md"
    >
        <a href={getURLForLanguage(i18n.lang, '/')} target="_blank" class="shrink-0">
            <Logo class="h-5 mt-0.5 mx-2 md:hidden" iconOnly={true} width="16" />
            <Logo class="h-5 mt-0.5 mx-2 hidden md:block" width="96" />
        </a>
        <Menubar.Root class="border-none shadow-none h-fit p-0">
            <Menubar.Menu>
                <Menubar.Trigger aria-label={i18n._('gpx.file')}>
                    <File size="18" class="md:hidden" />
                    <span class="hidden md:block">{i18n._('gpx.file')}</span>
                </Menubar.Trigger>
                <Menubar.Content class="border-none">
                    <Menubar.Item onclick={createFile}>
                        <Plus size="16" />
                        {i18n._('menu.new')}
                        <Shortcut key="+" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item onclick={triggerFileInput}>
                        <FolderOpen size="16" />
                        {i18n._('menu.open')}
                        <Shortcut key="O" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={fileActions.duplicateSelection}
                        disabled={$selection.size == 0}
                    >
                        <Copy size="16" />
                        {i18n._('menu.duplicate')}
                        <Shortcut key="D" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={() => tick().then(fileActions.deleteSelectedFiles)}
                        disabled={$selection.size == 0}
                    >
                        <FileX size="16" />
                        {i18n._('menu.delete')}
                        <Shortcut key="⌫" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={fileActions.deleteAllFiles}
                        disabled={fileStateCollection.size == 0}
                    >
                        <FileX size="16" />
                        {i18n._('menu.delete_all')}
                        <Shortcut key="⌫" ctrl={true} shift={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={() => (exportState.current = ExportState.SELECTION)}
                        disabled={$selection.size == 0}
                    >
                        <Download size="16" />
                        {i18n._('menu.export')}
                        <Shortcut key="S" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => (exportState.current = ExportState.ALL)}
                        disabled={fileStateCollection.size == 0}
                    >
                        <Download size="16" />
                        {i18n._('menu.export_all')}
                        <Shortcut key="S" ctrl={true} shift={true} />
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Menu>
            <Menubar.Menu>
                <Menubar.Trigger aria-label={i18n._('menu.edit')}>
                    <FilePen size="18" class="md:hidden" />
                    <span class="hidden md:block">{i18n._('menu.edit')}</span>
                </Menubar.Trigger>
                <Menubar.Content class="border-none">
                    <Menubar.Item onclick={() => fileActionManager.undo()} disabled={!$canUndo}>
                        <Undo2 size="16" />
                        {i18n._('menu.undo')}
                        <Shortcut key="Z" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item onclick={() => fileActionManager.redo()} disabled={!$canRedo}>
                        <Redo2 size="16" />
                        {i18n._('menu.redo')}
                        <Shortcut key="Z" ctrl={true} shift={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        disabled={$selection.size !== 1 ||
                            !$selection
                                .getSelected()
                                .every(
                                    (item) =>
                                        item instanceof ListFileItem ||
                                        item instanceof ListTrackItem
                                )}
                        onclick={() => (editMetadata.current = true)}
                    >
                        <Info size="16" />
                        {i18n._('menu.metadata.button')}
                        <Shortcut key="I" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        disabled={$selection.size === 0 ||
                            !$selection
                                .getSelected()
                                .every(
                                    (item) =>
                                        item instanceof ListFileItem ||
                                        item instanceof ListTrackItem
                                )}
                        onclick={() => (editStyle.current = true)}
                    >
                        <PaintBucket size="16" />
                        {i18n._('menu.style.button')}
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => {
                            if ($allHidden) {
                                fileActions.setHiddenToSelection(false);
                            } else {
                                fileActions.setHiddenToSelection(true);
                            }
                        }}
                        disabled={$selection.size == 0}
                    >
                        {#if $allHidden}
                            <Eye size="16" />
                            {i18n._('menu.unhide')}
                        {:else}
                            <EyeOff size="16" />
                            {i18n._('menu.hide')}
                        {/if}
                        <Shortcut key="H" ctrl={true} />
                    </Menubar.Item>
                    {#if $treeFileView}
                        {#if $selection.getSelected().some((item) => item instanceof ListFileItem)}
                            <Menubar.Separator />
                            <Menubar.Item
                                onclick={() =>
                                    fileActions.addNewTrack(
                                        $selection.getSelected()[0].getFileId()
                                    )}
                                disabled={$selection.size !== 1}
                            >
                                <Plus size="16" />
                                {i18n._('menu.new_track')}
                            </Menubar.Item>
                        {:else if $selection
                            .getSelected()
                            .some((item) => item instanceof ListTrackItem)}
                            <Menubar.Separator />
                            <Menubar.Item
                                onclick={() => {
                                    let item = $selection.getSelected()[0];
                                    fileActions.addNewSegment(
                                        item.getFileId(),
                                        item.getTrackIndex()
                                    );
                                }}
                                disabled={$selection.size !== 1}
                            >
                                <Plus size="16" />
                                {i18n._('menu.new_segment')}
                            </Menubar.Item>
                        {/if}
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={() => selection.selectAll()}
                        disabled={fileStateCollection.size == 0}
                    >
                        <FileStack size="16" />
                        {i18n._('menu.select_all')}
                        <Shortcut key="A" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => {
                            if ($selection.size > 0) {
                                boundsManager.centerMapOnSelection();
                            }
                        }}
                        disabled={$selection.size == 0}
                    >
                        <Maximize size="16" />
                        {i18n._('menu.center')}
                        <Shortcut key="⏎" ctrl={true} />
                    </Menubar.Item>
                    {#if $treeFileView}
                        <Menubar.Separator />
                        <Menubar.Item
                            onclick={() => selection.copySelection()}
                            disabled={$selection.size === 0}
                        >
                            <ClipboardCopy size="16" />
                            {i18n._('menu.copy')}
                            <Shortcut key="C" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item
                            onclick={() => selection.cutSelection()}
                            disabled={$selection.size === 0}
                        >
                            <Scissors size="16" />
                            {i18n._('menu.cut')}
                            <Shortcut key="X" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item
                            disabled={$copied === undefined ||
                                $copied.length === 0 ||
                                ($selection.size > 0 &&
                                    !allowedPastes[$copied[0].level].includes(
                                        $selection.getSelected().pop()!.level
                                    ))}
                            onclick={pasteSelection}
                        >
                            <ClipboardPaste size="16" />
                            {i18n._('menu.paste')}
                            <Shortcut key="V" ctrl={true} />
                        </Menubar.Item>
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={() => tick().then(fileActions.deleteSelection)}
                        disabled={$selection.size == 0}
                    >
                        <Trash2 size="16" />
                        {i18n._('menu.delete')}
                        <Shortcut key="⌫" ctrl={true} />
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Menu>
            <Menubar.Menu>
                <Menubar.Trigger aria-label={i18n._('menu.view')}>
                    <View size="18" class="md:hidden" />
                    <span class="hidden md:block">{i18n._('menu.view')}</span>
                </Menubar.Trigger>
                <Menubar.Content class="border-none">
                    <Menubar.CheckboxItem bind:checked={$elevationProfile}>
                        <ChartArea size="16" />
                        {i18n._('menu.elevation_profile')}
                        <Shortcut key="P" ctrl={true} />
                    </Menubar.CheckboxItem>
                    <Menubar.CheckboxItem bind:checked={$treeFileView}>
                        <ListTree size="16" />
                        {i18n._('menu.tree_file_view')}
                        <Shortcut key="L" ctrl={true} />
                    </Menubar.CheckboxItem>
                    <Menubar.Separator />
                    <Menubar.Item inset onclick={switchBasemaps}>
                        <Map size="16" />{i18n._('menu.switch_basemap')}<Shortcut key="F1" />
                    </Menubar.Item>
                    <Menubar.Item inset onclick={toggleOverlays}>
                        <Layers2 size="16" />{i18n._('menu.toggle_overlays')}<Shortcut key="F2" />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.CheckboxItem bind:checked={$distanceMarkers}>
                        <Coins size="16" />{i18n._('menu.distance_markers')}<Shortcut key="F3" />
                    </Menubar.CheckboxItem>
                    <Menubar.CheckboxItem bind:checked={$directionMarkers}>
                        <Milestone size="16" />{i18n._('menu.direction_markers')}<Shortcut
                            key="F4"
                        />
                    </Menubar.CheckboxItem>
                    <Menubar.Separator />
                    <Menubar.Item inset onclick={() => map.toggle3D()}>
                        <Box size="16" />
                        {i18n._('menu.toggle_3d')}
                        <Shortcut key="{i18n._('menu.ctrl')} {i18n._('menu.drag')}" />
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Menu>
            <Menubar.Menu>
                <Menubar.Trigger aria-label={i18n._('menu.settings')}>
                    <Settings size="18" class="md:hidden" />
                    <span class="hidden md:block">
                        {i18n._('menu.settings')}
                    </span>
                </Menubar.Trigger>
                <Menubar.Content class="border-none">
                    <Menubar.Sub>
                        <Menubar.SubTrigger>
                            <Ruler size="16" class="mr-2" />{i18n._('menu.distance_units')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={$distanceUnits}>
                                <Menubar.RadioItem value="metric"
                                    >{i18n._('menu.metric')}</Menubar.RadioItem
                                >
                                <Menubar.RadioItem value="imperial"
                                    >{i18n._('menu.imperial')}</Menubar.RadioItem
                                >
                                <Menubar.RadioItem value="nautical"
                                    >{i18n._('menu.nautical')}</Menubar.RadioItem
                                >
                            </Menubar.RadioGroup>
                        </Menubar.SubContent>
                    </Menubar.Sub>
                    <Menubar.Sub>
                        <Menubar.SubTrigger>
                            <Zap size="16" class="mr-2" />{i18n._('menu.velocity_units')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={$velocityUnits}>
                                <Menubar.RadioItem value="speed"
                                    >{i18n._('quantities.speed')}</Menubar.RadioItem
                                >
                                <Menubar.RadioItem value="pace"
                                    >{i18n._('quantities.pace')}</Menubar.RadioItem
                                >
                            </Menubar.RadioGroup>
                        </Menubar.SubContent>
                    </Menubar.Sub>
                    <Menubar.Sub>
                        <Menubar.SubTrigger>
                            <Thermometer size="16" class="mr-2" />{i18n._('menu.temperature_units')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={$temperatureUnits}>
                                <Menubar.RadioItem value="celsius"
                                    >{i18n._('menu.celsius')}</Menubar.RadioItem
                                >
                                <Menubar.RadioItem value="fahrenheit"
                                    >{i18n._('menu.fahrenheit')}</Menubar.RadioItem
                                >
                            </Menubar.RadioGroup>
                        </Menubar.SubContent>
                    </Menubar.Sub>
                    <Menubar.Separator />
                    <Menubar.Sub>
                        <Menubar.SubTrigger>
                            <Languages size="16" class="mr-2" />
                            {i18n._('menu.language')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup value={i18n.lang}>
                                {#each Object.entries(languages) as [lang, label]}
                                    <a href={getURLForLanguage(lang, '/app')}>
                                        <Menubar.RadioItem value={lang}>{label}</Menubar.RadioItem>
                                    </a>
                                {/each}
                            </Menubar.RadioGroup>
                        </Menubar.SubContent>
                    </Menubar.Sub>
                    <Menubar.Sub>
                        <Menubar.SubTrigger>
                            {#if mode.current === 'light' || !mode.current}
                                <Sun size="16" class="mr-2" />
                            {:else}
                                <Moon size="16" class="mr-2" />
                            {/if}
                            {i18n._('menu.mode')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup
                                value={mode.current ?? 'light'}
                                onValueChange={(value) => {
                                    setMode(value as 'light' | 'dark');
                                }}
                            >
                                <Menubar.RadioItem value="light"
                                    >{i18n._('menu.light')}</Menubar.RadioItem
                                >
                                <Menubar.RadioItem value="dark"
                                    >{i18n._('menu.dark')}</Menubar.RadioItem
                                >
                            </Menubar.RadioGroup>
                        </Menubar.SubContent>
                    </Menubar.Sub>
                    <Menubar.Separator />
                    <Menubar.Sub>
                        <Menubar.SubTrigger>
                            <PersonStanding size="16" class="mr-2" />
                            {i18n._('menu.street_view_source')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={$streetViewSource}>
                                <Menubar.RadioItem value="mapillary"
                                    >{i18n._('menu.mapillary')}</Menubar.RadioItem
                                >
                                <Menubar.RadioItem value="google"
                                    >{i18n._('menu.google')}</Menubar.RadioItem
                                >
                            </Menubar.RadioGroup>
                        </Menubar.SubContent>
                    </Menubar.Sub>
                    <Menubar.Item onclick={() => (layerSettingsOpen = true)}>
                        <Layers size="16" />
                        {i18n._('menu.layers')}
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item onclick={exportSettings}>
                        <Upload size="16" />
                        {i18n._('menu.settings_export.export')}
                    </Menubar.Item>
                    <Menubar.Item onclick={importSettings}>
                        <Download size="16" />
                        {i18n._('menu.settings_export.import')}
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Menu>
        </Menubar.Root>
        <div class="h-fit flex flex-row items-center ml-1 gap-1">
            <Button
                variant="ghost"
                href="./help"
                target="_blank"
                class="cursor-default h-fit rounded-sm px-3 py-0.5"
                aria-label={i18n._('menu.help')}
            >
                <BookOpenText size="18" class="md:hidden" />
                <span class="hidden md:block">
                    {i18n._('menu.help')}
                </span>
            </Button>
            <Button
                variant="ghost"
                href="https://ko-fi.com/gpxstudio"
                target="_blank"
                class="cursor-default h-fit rounded-sm font-bold text-support hover:text-support px-3 py-0.5"
                aria-label={i18n._('menu.donate')}
            >
                <HeartHandshake size="18" class="md:hidden" />
                <span class="hidden md:flex flex-row items-center">
                    {i18n._('menu.donate')}
                    <Heart size="16" class="ml-1" fill="var(--support)" />
                </span>
            </Button>
        </div>
    </div>
</div>

<Export />
<LayerControlSettings bind:open={layerSettingsOpen} />

<svelte:window
    on:keydown={(e) => {
        let targetInput =
            e &&
            e.target &&
            (e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA' ||
                e.target.tagName === 'SELECT' ||
                e.target.role === 'combobox' ||
                e.target.role === 'radio' ||
                e.target.role === 'menu' ||
                e.target.role === 'menuitem' ||
                e.target.role === 'menuitemradio' ||
                e.target.role === 'menuitemcheckbox');

        if (e.key === '+' && (e.metaKey || e.ctrlKey)) {
            createFile();
            e.preventDefault();
        } else if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
            triggerFileInput();
            e.preventDefault();
        } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
            fileActions.duplicateSelection();
            e.preventDefault();
        } else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                selection.copySelection();
                e.preventDefault();
            }
        } else if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                selection.cutSelection();
                e.preventDefault();
            }
        } else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                pasteSelection();
                e.preventDefault();
            }
        } else if ((e.key === 's' || e.key == 'S') && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
                if (fileStateCollection.size > 0) {
                    exportState.current = ExportState.ALL;
                }
            } else if ($selection.size > 0) {
                exportState.current = ExportState.SELECTION;
            }
            e.preventDefault();
        } else if ((e.key === 'z' || e.key == 'Z') && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
                fileActionManager.redo();
            } else {
                fileActionManager.undo();
            }
            e.preventDefault();
        } else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                if (e.shiftKey) {
                    fileActions.deleteAllFiles();
                } else {
                    fileActions.deleteSelection();
                }
                e.preventDefault();
            }
        } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                selection.selectAll();
                e.preventDefault();
            }
        } else if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
            if (
                $selection.size === 1 &&
                $selection
                    .getSelected()
                    .every((item) => item instanceof ListFileItem || item instanceof ListTrackItem)
            ) {
                editMetadata.current = true;
            }
            e.preventDefault();
        } else if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
            $elevationProfile = !$elevationProfile;
            e.preventDefault();
        } else if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
            $treeFileView = !$treeFileView;
            e.preventDefault();
        } else if (e.key === 'h' && (e.metaKey || e.ctrlKey)) {
            if ($allHidden) {
                fileActions.setHiddenToSelection(false);
            } else {
                fileActions.setHiddenToSelection(true);
            }
            e.preventDefault();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            if ($selection.size > 0) {
                boundsManager.centerMapOnSelection();
            }
        } else if (e.key === 'F1') {
            switchBasemaps();
            e.preventDefault();
        } else if (e.key === 'F2') {
            toggleOverlays();
            e.preventDefault();
        } else if (e.key === 'F3') {
            $distanceMarkers = !$distanceMarkers;
            e.preventDefault();
        } else if (e.key === 'F4') {
            $directionMarkers = !$directionMarkers;
            e.preventDefault();
        } else if (e.key === 'F5') {
            $routing = !$routing;
            e.preventDefault();
        } else if (
            e.key === 'ArrowRight' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowUp'
        ) {
            if (!targetInput) {
                selection.updateFromKey(
                    e.key === 'ArrowRight' || e.key === 'ArrowDown',
                    e.shiftKey
                );
                e.preventDefault();
            }
        }
    }}
    on:dragover={(e) => e.preventDefault()}
    on:drop={(e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            loadFiles(e.dataTransfer.files);
        }
    }}
/>

<style lang="postcss">
    @reference "../../app.css";

    div :global(button) {
        @apply hover:bg-accent;
        @apply px-3;
        @apply py-0.5;
    }
</style>
