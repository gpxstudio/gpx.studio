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
        Save,
        SaveAll,
        BookOpenText,
        ChartArea,
        Maximize,
        Maximize2,
        Minimize2,
        FolderX,
        ArrowRightLeft,
    } from '@lucide/svelte';
    import { map } from '$lib/components/map/map';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { exportState, ExportState } from '$lib/components/export/utils.svelte';
    import { anySelectedLayer } from '$lib/components/map/layer-control/utils';
    import { defaultOverlays } from '$lib/data/layers';
    import LayerControlSettings from '$lib/components/map/layer-control/LayerControlSettings.svelte';
    import Export from '$lib/components/export/Export.svelte';
    import { mode, setMode } from 'mode-watcher';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { languages } from '$lib/i18n/languages';
    import { getURLForLanguage } from '$lib/utils';
    import { settings } from '$lib/state/settings';
    import {
        closeAll,
        closeFiles,
        closeFolder,
        createFile,
        createRouteFile,
        loadFiles,
        openFiles,
        openFolder,
        saveAll,
        saveAs,
        saveSelected,
    } from '$lib/actions/file-actions';
    import UnsavedDialog from '$lib/components/file-list/UnsavedDialog.svelte';
    import { engine } from '$lib/engine';
    import { allHidden, selectedFilesConversion } from '$lib/engine/selection-stores';
    import { selectedFileIds, selectionSize } from '$lib/engine/selection-helpers';
    import { boundsManager } from '$lib/state/bounds';
    import { onMount } from 'svelte';

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

    const { files, selection, canUndo, canRedo, canPaste, workspace } = engine;

    let selectionCount = $derived(selectionSize($selection));
    let noFiles = $derived($files.size === 0);
    // the desktop app: the files are linked to the file system
    let desktop = $derived($workspace !== undefined);
    let selectedIds = $derived(selectedFileIds($selection));
    let anyUnsaved = $derived(Object.values($workspace?.files ?? {}).some((file) => file.dirty));
    // metadata and style can be edited for files, routes and tracks only
    let filesOrTracksSelected = $derived(
        $selection.type === 'file' || $selection.type === 'route' || $selection.type === 'track'
    );

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
    let fullscreen = $state(false);

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    onMount(() => {
        const handler = () => {
            fullscreen = document.fullscreenElement !== null;
        };
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    });
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
                        {i18n._('menu.new_file')}
                        <Shortcut key="+" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item onclick={createRouteFile}>
                        <Plus size="16" />
                        {i18n._('menu.new_route_file')}
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item onclick={openFiles}>
                        <FolderOpen size="16" />
                        {i18n._('menu.open')}
                        <Shortcut key="O" ctrl={true} />
                    </Menubar.Item>
                    {#if desktop}
                        <Menubar.Item onclick={openFolder}>
                            <FolderOpen size="16" />
                            {i18n._('menu.open_folder')}
                            <Shortcut key="O" ctrl={true} shift={true} />
                        </Menubar.Item>
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item onclick={() => engine.duplicate()} disabled={selectionCount == 0}>
                        <Copy size="16" />
                        {i18n._('menu.duplicate')}
                        <Shortcut key="D" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    {#if desktop}
                        <Menubar.Item
                            onclick={() => saveSelected(selectedIds)}
                            disabled={selectionCount == 0 && !anyUnsaved}
                        >
                            <Save size="16" />
                            {i18n._('menu.save')}
                            <Shortcut key="S" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item onclick={saveAll} disabled={!anyUnsaved}>
                            <Save size="16" />
                            {i18n._('menu.save_all')}
                            <Shortcut key="S" ctrl={true} shift={true} />
                        </Menubar.Item>
                        <Menubar.Item
                            onclick={() => saveAs(selectedIds)}
                            disabled={selectedIds.length !== 1}
                        >
                            <SaveAll size="16" />
                            {i18n._('menu.save_as')}
                        </Menubar.Item>
                        <Menubar.Separator />
                        <Menubar.Item
                            onclick={() => closeFiles(selectedIds)}
                            disabled={selectedIds.length === 0}
                        >
                            <FileX size="16" />
                            {i18n._('menu.close')}
                            <Shortcut key="W" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item onclick={closeAll} disabled={noFiles}>
                            <FileX size="16" />
                            {i18n._('menu.close_all')}
                            <Shortcut key="W" ctrl={true} shift={true} />
                        </Menubar.Item>
                        <Menubar.Item onclick={closeFolder} disabled={!$workspace?.folder}>
                            <FolderX size="16" />
                            {i18n._('menu.close_folder')}
                        </Menubar.Item>
                    {:else}
                        <Menubar.Item
                            onclick={() => engine.delete(true)}
                            disabled={selectionCount == 0}
                        >
                            <FileX size="16" />
                            {i18n._('menu.delete')}
                            <Shortcut key="⌫" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item onclick={() => engine.deleteAll()} disabled={noFiles}>
                            <FileX size="16" />
                            {i18n._('menu.delete_all')}
                            <Shortcut key="⌫" ctrl={true} shift={true} />
                        </Menubar.Item>
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item
                        onclick={() => (exportState.current = ExportState.SELECTION)}
                        disabled={selectionCount == 0}
                    >
                        <Download size="16" />
                        {i18n._('menu.export')}
                        {#if !desktop}<Shortcut key="S" ctrl={true} />{/if}
                    </Menubar.Item>
                    <Menubar.Item
                        onclick={() => (exportState.current = ExportState.ALL)}
                        disabled={noFiles}
                    >
                        <Download size="16" />
                        {i18n._('menu.export_all')}
                        {#if !desktop}<Shortcut key="S" ctrl={true} shift={true} />{/if}
                    </Menubar.Item>
                </Menubar.Content>
            </Menubar.Menu>
            <Menubar.Menu>
                <Menubar.Trigger aria-label={i18n._('menu.edit')}>
                    <FilePen size="18" class="md:hidden" />
                    <span class="hidden md:block">{i18n._('menu.edit')}</span>
                </Menubar.Trigger>
                <Menubar.Content class="border-none">
                    <Menubar.Item onclick={() => engine.undo()} disabled={!$canUndo}>
                        <Undo2 size="16" />
                        {i18n._('menu.undo')}
                        <Shortcut key="Z" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item onclick={() => engine.redo()} disabled={!$canRedo}>
                        <Redo2 size="16" />
                        {i18n._('menu.redo')}
                        <Shortcut key="Z" ctrl={true} shift={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item
                        disabled={selectionCount !== 1 || !filesOrTracksSelected}
                        onclick={() => (editMetadata.current = true)}
                    >
                        <Info size="16" />
                        {i18n._('menu.metadata.button')}
                        <Shortcut key="I" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Item
                        disabled={selectionCount === 0 || !filesOrTracksSelected}
                        onclick={() => (editStyle.current = true)}
                    >
                        <PaintBucket size="16" />
                        {i18n._('menu.style.button')}
                    </Menubar.Item>
                    {#if $treeFileView}
                        {#if $selection.type === 'file'}
                            <Menubar.Separator />
                            <Menubar.Item
                                onclick={() => engine.newTrack()}
                                disabled={selectionCount !== 1}
                            >
                                <Plus size="16" />
                                {i18n._('menu.new_track')}
                            </Menubar.Item>
                            <Menubar.Item
                                onclick={() => engine.newRoute()}
                                disabled={selectionCount !== 1}
                            >
                                <Plus size="16" />
                                {i18n._('menu.new_route')}
                            </Menubar.Item>
                        {:else if $selection.type === 'track'}
                            <Menubar.Separator />
                            <Menubar.Item
                                onclick={() => engine.newTrackSegment()}
                                disabled={selectionCount !== 1}
                            >
                                <Plus size="16" />
                                {i18n._('menu.new_segment')}
                            </Menubar.Item>
                        {/if}
                        {#if $selection.type === 'route' || $selection.type === 'track' || $selection.type === 'segment'}
                            {#if $selection.type !== 'track'}
                                <Menubar.Separator />
                            {/if}
                            <Menubar.Item onclick={() => engine.convert()}>
                                <ArrowRightLeft size="16" />
                                {i18n._(
                                    $selection.type === 'route'
                                        ? 'menu.convert_to_track'
                                        : 'menu.convert_to_route'
                                )}
                            </Menubar.Item>
                        {/if}
                    {/if}
                    {#if $selectedFilesConversion}
                        {#if !$treeFileView}
                            <Menubar.Separator />
                        {/if}
                        <Menubar.Item onclick={() => engine.convert()}>
                            <ArrowRightLeft size="16" />
                            {i18n._(
                                $selectedFilesConversion === 'route'
                                    ? 'menu.convert_to_routes'
                                    : 'menu.convert_to_tracks'
                            )}
                        </Menubar.Item>
                    {/if}
                    <Menubar.Separator />
                    <Menubar.Item onclick={() => engine.selectAll()} disabled={noFiles}>
                        <FileStack size="16" />
                        {i18n._('menu.select_all')}
                        <Shortcut key="A" ctrl={true} />
                    </Menubar.Item>
                    {#if $treeFileView}
                        <Menubar.Separator />
                        <Menubar.Item onclick={() => engine.copy()} disabled={selectionCount === 0}>
                            <ClipboardCopy size="16" />
                            {i18n._('menu.copy')}
                            <Shortcut key="C" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item onclick={() => engine.cut()} disabled={selectionCount === 0}>
                            <Scissors size="16" />
                            {i18n._('menu.cut')}
                            <Shortcut key="X" ctrl={true} />
                        </Menubar.Item>
                        <Menubar.Item disabled={!$canPaste} onclick={() => engine.paste()}>
                            <ClipboardPaste size="16" />
                            {i18n._('menu.paste')}
                            <Shortcut key="V" ctrl={true} />
                        </Menubar.Item>
                    {/if}
                    {#if !desktop}
                        <Menubar.Separator />
                        <Menubar.Item
                            onclick={() => engine.delete()}
                            disabled={selectionCount == 0}
                        >
                            <Trash2 size="16" />
                            {i18n._('menu.delete')}
                            <Shortcut key="⌫" ctrl={true} />
                        </Menubar.Item>
                    {/if}
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
                    <Menubar.Item
                        inset
                        onclick={() => engine.setSelectionHidden(!$allHidden)}
                        disabled={selectionCount == 0}
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
                    <Menubar.Item
                        inset
                        onclick={() => {
                            if (selectionCount > 0) {
                                boundsManager.centerMapOnSelection();
                            }
                        }}
                        disabled={selectionCount == 0}
                    >
                        <Maximize size="16" />
                        {i18n._('menu.center')}
                        <Shortcut key="⏎" ctrl={true} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.Item inset onclick={() => map.toggle3D()}>
                        <Box size="16" />
                        {i18n._('menu.toggle_3d')}
                        <Shortcut key={i18n._('menu.right_click_drag')} />
                    </Menubar.Item>
                    <Menubar.Separator />
                    <Menubar.CheckboxItem checked={fullscreen} onCheckedChange={toggleFullscreen}>
                        {#if fullscreen}
                            <Minimize2 size="16" />
                        {:else}
                            <Maximize2 size="16" />
                        {/if}
                        {i18n._('menu.fullscreen')}
                        <Shortcut key="F11" />
                    </Menubar.CheckboxItem>
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
                            <Ruler size="16" />{i18n._('menu.distance_units')}
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
                            <Zap size="16" />{i18n._('menu.velocity_units')}
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
                            <Thermometer size="16" />{i18n._('menu.temperature_units')}
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
                            <Languages size="16" />
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
                                <Sun size="16" />
                            {:else}
                                <Moon size="16" />
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
                            <PersonStanding size="16" />
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
                </Menubar.Content>
            </Menubar.Menu>
        </Menubar.Root>
        <div class="h-fit flex flex-row items-center">
            <Button
                variant="ghost"
                href="./help"
                target="_blank"
                class="cursor-default h-fit rounded-md px-3 py-0.5"
                aria-label={i18n._('menu.help')}
            >
                <BookOpenText size="18" class="md:hidden" />
                <span class="hidden md:block">
                    {i18n._('menu.help')}
                </span>
            </Button>
            <Button
                variant="ghost"
                href="https://opencollective.com/gpxstudio"
                target="_blank"
                class="cursor-default h-fit rounded-md font-bold text-support hover:text-support px-3 py-0.5"
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
<UnsavedDialog />
<LayerControlSettings bind:open={layerSettingsOpen} />

<svelte:window
    on:keydown={(e) => {
        let targetInput =
            e &&
            e.target &&
            e.target instanceof HTMLElement &&
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
        } else if ((e.key === 'o' || e.key === 'O') && (e.metaKey || e.ctrlKey)) {
            if (desktop && e.shiftKey) {
                openFolder();
            } else {
                openFiles();
            }
            e.preventDefault();
        } else if (desktop && (e.key === 'w' || e.key === 'W') && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
                closeAll();
            } else {
                closeFiles(selectedIds);
            }
            e.preventDefault();
        } else if (desktop && (e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
                saveAll();
            } else {
                saveSelected(selectedIds);
            }
            e.preventDefault();
        } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
            engine.duplicate();
            e.preventDefault();
        } else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                engine.copy();
                e.preventDefault();
            }
        } else if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                engine.cut();
                e.preventDefault();
            }
        } else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                engine.paste();
                e.preventDefault();
            }
        } else if ((e.key === 's' || e.key == 'S') && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
                if (!noFiles) {
                    exportState.current = ExportState.ALL;
                }
            } else if (selectionCount > 0) {
                exportState.current = ExportState.SELECTION;
            }
            e.preventDefault();
        } else if ((e.key === 'z' || e.key == 'Z') && (e.metaKey || e.ctrlKey)) {
            if (e.shiftKey) {
                engine.redo();
            } else {
                engine.undo();
            }
            e.preventDefault();
        } else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) {
            // the desktop app closes files instead
            if (!targetInput && !desktop) {
                if (e.shiftKey) {
                    engine.deleteAll();
                } else {
                    engine.delete();
                }
                e.preventDefault();
            }
        } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
            if (!targetInput) {
                engine.selectAll();
                e.preventDefault();
            }
        } else if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
            if (selectionCount === 1 && filesOrTracksSelected) {
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
            engine.setSelectionHidden(!$allHidden);
            e.preventDefault();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            if (selectionCount > 0) {
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
                engine.arrowSelect(e.key === 'ArrowRight' || e.key === 'ArrowDown', e.shiftKey);
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
