<script lang="ts">
    import * as Menubar from '$lib/components/ui/menubar/index.js';
    import { Button } from '$lib/components/ui/button';
    import Logo from '$lib/components/Logo.svelte';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import {
        Plus,
        Copy,
        Download,
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
    import { map } from '$lib/components/map/utils.svelte';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { exportState, ExportState } from '$lib/components/export/utils.svelte';
    // import {
    //     triggerFileInput,
    //     createFile,
    //     loadFiles,
    //     updateSelectionFromKey,
    //     allHidden,
    // } from '$lib/stores';
    // import { canUndo, canRedo, fileActions, fileObservers, settings } from '$lib/db';
    import { anySelectedLayer } from '$lib/components/map/layer-control/utils.svelte';
    import { defaultOverlays } from '$lib/assets/layers';
    // import LayerControlSettings from '$lib/components/map/layer-control/LayerControlSettings.svelte';
    import {
        allowedPastes,
        ListFileItem,
        ListTrackItem,
    } from '$lib/components/file-list/file-list';
    import Export from '$lib/components/export/Export.svelte';
    import { mode, setMode } from 'mode-watcher';
    import { i18n } from '$lib/i18n.svelte';
    import { languages } from '$lib/languages';
    import { getURLForLanguage } from '$lib/utils';
    import { settings } from '$lib/logic/settings.svelte';
    import {
        createFile,
        fileActions,
        loadFiles,
        pasteSelection,
        triggerFileInput,
    } from '$lib/logic/file-actions.svelte';
    import { fileStateCollection } from '$lib/logic/file-state.svelte';
    import { fileActionManager } from '$lib/logic/file-action-manager.svelte';
    import { selection } from '$lib/logic/selection.svelte';

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

    function switchBasemaps() {
        [currentBasemap.value, previousBasemap.value] = [
            previousBasemap.value,
            currentBasemap.value,
        ];
    }

    function toggleOverlays() {
        if (currentOverlays.value && anySelectedLayer(currentOverlays.value)) {
            previousOverlays.value = JSON.parse(JSON.stringify(currentOverlays.value));
            currentOverlays.value = defaultOverlays;
        } else {
            currentOverlays.value = JSON.parse(JSON.stringify(previousOverlays.value));
            previousOverlays.value = defaultOverlays;
        }
    }

    let layerSettingsOpen = $state(false);
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
                        <Plus size="16" class="mr-1" />
                        {i18n._('menu.new')}
                        <Shortcut key="+" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item onclick={triggerFileInput}>
                        <FolderOpen size="16" class="mr-1" />
                        {i18n._('menu.open')}
                        <Shortcut key="O" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={fileActions.duplicateSelection}
                        disabled={selection.value.size == 0}
                    >
                        <Copy size="16" class="mr-1" />
                        {i18n._('menu.duplicate')}
                        <Shortcut key="D" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={fileActions.deleteSelectedFiles}
                        disabled={selection.value.size == 0}
                    >
                        <FileX size="16" class="mr-1" />
                        {i18n._('menu.close')}
                        <Shortcut key="⌫" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={fileActions.deleteAllFiles}
                        disabled={fileStateCollection.size == 0}
                    >
                        <FileX size="16" class="mr-1" />
                        {i18n._('menu.close_all')}
                        <Shortcut key="⌫" ctrl={true} shift={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={() => (exportState.current = ExportState.SELECTION)}
                        disabled={selection.value.size == 0}
                    >
                        <Download size="16" class="mr-1" />
                        {i18n._('menu.export')}
                        <Shortcut key="S" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => (exportState.current = ExportState.ALL)}
                        disabled={fileStateCollection.size == 0}
                    >
                        <Download size="16" class="mr-1" />
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
                    <Menubar.Item
                        onclick={fileActionManager.undo}
                        disabled={!fileActionManager.canUndo}
                    >
                        <Undo2 size="16" class="mr-1" />
                        {i18n._('menu.undo')}
                        <Shortcut key="Z" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={fileActionManager.redo}
                        disabled={!fileActionManager.canRedo}
                    >
                        <Redo2 size="16" class="mr-1" />
                        {i18n._('menu.redo')}
                        <Shortcut key="Z" ctrl={true} shift={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        disabled={selection.value.size !== 1 ||
                            !selection.value
                                .getSelected()
                                .every(
                                    (item) =>
                                        item instanceof ListFileItem ||
                                        item instanceof ListTrackItem
                                )}
                        onclick={() => (editMetadata.current = true)}
                    >
                        <Info size="16" class="mr-1" />
                        {i18n._('menu.metadata.button')}
                        <Shortcut key="I" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        disabled={selection.value.size === 0 ||
                            !selection.value
                                .getSelected()
                                .every(
                                    (item) =>
                                        item instanceof ListFileItem ||
                                        item instanceof ListTrackItem
                                )}
                        onclick={() => (editStyle.current = true)}
                    >
                        <PaintBucket size="16" class="mr-1" />
                        {i18n._('menu.style.button')}
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => {
                            // if ($allHidden) {
                            //     fileActions.setHiddenToSelection(false);
                            // } else {
                            //     fileActions.setHiddenToSelection(true);
                            // }
                        }}
                        disabled={selection.value.size == 0}
                    >
                        <!-- {#if $allHidden}
                            <Eye size="16" class="mr-1" />
                            {i18n._('menu.unhide')}
                        {:else}
                            <EyeOff size="16" class="mr-1" />
                            {i18n._('menu.hide')}
                        {/if} -->
                        <Shortcut key="H" ctrl={true} />
                    </Menubar.Item>
                    {#if treeFileView.value}
                        {#if selection.value
                            .getSelected()
                            .some((item) => item instanceof ListFileItem)}
                            <Menubar.Separator />
                            <Menubar.Item
                                onclick={() =>
                                    fileActions.addNewTrack(
                                        selection.value.getSelected()[0].getFileId()
                                    )}
                                disabled={selection.value.size !== 1}
                            >
                                <Plus size="16" class="mr-1" />
                                {i18n._('menu.new_track')}
                            </Menubar.Item>
                        {:else if selection.value
                            .getSelected()
                            .some((item) => item instanceof ListTrackItem)}
                            <Menubar.Separator />
                            <Menubar.Item
                                onclick={() => {
                                    let item = selection.value.getSelected()[0];
                                    fileActions.addNewSegment(
                                        item.getFileId(),
                                        item.getTrackIndex()
                                    );
                                }}
                                disabled={selection.value.size !== 1}
                            >
                                <Plus size="16" class="mr-1" />
                                {i18n._('menu.new_segment')}
                            </Menubar.Item>
                        {/if}
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={selection.selectAll}
                        disabled={fileStateCollection.size == 0}
                    >
                        <FileStack size="16" class="mr-1" />
                        {i18n._('menu.select_all')}
                        <Shortcut key="A" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => {
                            if (selection.value.size > 0) {
                                // centerMapOnSelection();
                            }
                        }}
                    >
                        <Maximize size="16" class="mr-1" />
                        {i18n._('menu.center')}
                        <Shortcut key="⏎" ctrl={true} />
                    </Menubar.Item>
                    {#if treeFileView.value}
                        <Menubar.Separator />
                        <Menubar.Item
                            onclick={selection.copySelection}
                            disabled={selection.value.size === 0}
                        >
                            <ClipboardCopy size="16" class="mr-1" />
                            {i18n._('menu.copy')}
                            <Shortcut key="C" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item
                            onclick={selection.cutSelection}
                            disabled={selection.value.size === 0}
                        >
                            <Scissors size="16" class="mr-1" />
                            {i18n._('menu.cut')}
                            <Shortcut key="X" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item
                            disabled={selection.copied === undefined ||
                                selection.copied.length === 0 ||
                                (selection.value.size > 0 &&
                                    !allowedPastes[selection.copied[0].level].includes(
                                        selection.value.getSelected().pop()?.level
                                    ))}
                            onclick={pasteSelection}
                        >
                            <ClipboardPaste size="16" class="mr-1" />
                            {i18n._('menu.paste')}
                            <Shortcut key="V" ctrl={true} />
                        </Menubar.Item>
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={fileActions.deleteSelection}
                        disabled={selection.value.size == 0}
                    >
                        <Trash2 size="16" class="mr-1" />
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
                    <Menubar.CheckboxItem bind:checked={elevationProfile.value}>
                        <ChartArea size="16" class="mr-1" />
                        {i18n._('menu.elevation_profile')}
                        <Shortcut key="P" ctrl={true} />
                    </Menubar.CheckboxItem>
                    <Menubar.CheckboxItem bind:checked={treeFileView.value}>
                        <ListTree size="16" class="mr-1" />
                        {i18n._('menu.tree_file_view')}
                        <Shortcut key="L" ctrl={true} />
                    </Menubar.CheckboxItem>
                    <Menubar.Separator />
                    <Menubar.Item inset onclick={switchBasemaps}>
                        <Map size="16" class="mr-1" />{i18n._('menu.switch_basemap')}<Shortcut
                            key="F1"
                        />
                    </Menubar.Item>
                    <Menubar.Item inset onclick={toggleOverlays}>
                        <Layers2 size="16" class="mr-1" />{i18n._('menu.toggle_overlays')}<Shortcut
                            key="F2"
                        />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.CheckboxItem bind:checked={distanceMarkers.value}>
                        <Coins size="16" class="mr-1" />{i18n._('menu.distance_markers')}<Shortcut
                            key="F3"
                        />
                    </Menubar.CheckboxItem>
                    <Menubar.CheckboxItem bind:checked={directionMarkers.value}>
                        <Milestone size="16" class="mr-1" />{i18n._(
                            'menu.direction_markers'
                        )}<Shortcut key="F4" />
                    </Menubar.CheckboxItem>
                    <Menubar.Separator />
                    <Menubar.Item inset onclick={map.toggle3D}>
                        <Box size="16" class="mr-1" />
                        {i18n._('menu.toggle_3d')}
                        <Shortcut key="{i18n._('menu.ctrl')}+{i18n._('menu.drag')}" />
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
                            <Ruler size="16" class="mr-1" />{i18n._('menu.distance_units')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={distanceUnits.value}>
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
                            <Zap size="16" class="mr-1" />{i18n._('menu.velocity_units')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={velocityUnits.value}>
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
                            <Thermometer size="16" class="mr-1" />{i18n._('menu.temperature_units')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={temperatureUnits.value}>
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
                            <Languages size="16" class="mr-1" />
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
                                <Sun size="16" class="mr-1" />
                            {:else}
                                <Moon size="16" class="mr-1" />
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
                            <PersonStanding size="16" class="mr-1" />
                            {i18n._('menu.street_view_source')}
                        </Menubar.SubTrigger>
                        <Menubar.SubContent>
                            <Menubar.RadioGroup bind:value={streetViewSource.value}>
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
                        <Layers size="16" class="mr-1" />
                        {i18n._('menu.layers')}
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
                    <Heart size="16" class="ml-1" fill="rgb(var(--support))" />
                </span>
            </Button>
        </div>
    </div>
</div>

<Export />
<!-- <LayerControlSettings bind:open={layerSettingsOpen} /> -->

<svelte:window
    on:keydown={(e) => {
        let targetInput =
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.tagName === 'SELECT' ||
            e.target.role === 'combobox' ||
            e.target.role === 'radio' ||
            e.target.role === 'menu' ||
            e.target.role === 'menuitem' ||
            e.target.role === 'menuitemradio' ||
            e.target.role === 'menuitemcheckbox';

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
            } else if (selection.value.size > 0) {
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
                selection.value.size === 1 &&
                selection.value
                    .getSelected()
                    .every((item) => item instanceof ListFileItem || item instanceof ListTrackItem)
            ) {
                editMetadata.current = true;
            }
            e.preventDefault();
        } else if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
            elevationProfile.value = !elevationProfile.value;
            e.preventDefault();
        } else if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
            treeFileView.value = !treeFileView.value;
            e.preventDefault();
        } else if (e.key === 'h' && (e.metaKey || e.ctrlKey)) {
            // if ($allHidden) {
            //     fileActions.setHiddenToSelection(false);
            // } else {
            //     fileActions.setHiddenToSelection(true);
            // }
            e.preventDefault();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            // if ($selection.size > 0) {
            //     centerMapOnSelection();
            // }
        } else if (e.key === 'F1') {
            switchBasemaps();
            e.preventDefault();
        } else if (e.key === 'F2') {
            toggleOverlays();
            e.preventDefault();
        } else if (e.key === 'F3') {
            distanceMarkers.value = !distanceMarkers.value;
            e.preventDefault();
        } else if (e.key === 'F4') {
            directionMarkers.value = !directionMarkers.value;
            e.preventDefault();
        } else if (e.key === 'F5') {
            routing.value = !routing.value;
            e.preventDefault();
        } else if (
            e.key === 'ArrowRight' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowUp'
        ) {
            if (!targetInput) {
                // updateSelectionFromKey(e.key === 'ArrowRight' || e.key === 'ArrowDown', e.shiftKey);
                e.preventDefault();
            }
        }
    }}
    on:dragover={(e) => e.preventDefault()}
    on:drop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
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
