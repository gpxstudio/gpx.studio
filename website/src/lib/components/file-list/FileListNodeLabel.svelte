<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as ContextMenu from '$lib/components/ui/context-menu';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import {
        Copy,
        Info,
        MapPin,
        PaintBucket,
        Plus,
        Trash2,
        Waypoints,
        Eye,
        EyeOff,
        ClipboardCopy,
        ClipboardPaste,
        Maximize,
        Scissors,
        FileStack,
    } from '@lucide/svelte';
    import { ListLevel } from './file-list';
    import { getContext } from 'svelte';
    import { i18n } from '$lib/i18n.svelte';
    import MetadataDialog from '$lib/components/file-list/metadata/MetadataDialog.svelte';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import StyleDialog from '$lib/components/file-list/style/StyleDialog.svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { getSymbolKey, symbols } from '$lib/assets/symbols';
    import { engine, type FileState } from '$lib/engine';
    import { allHidden } from '$lib/all-hidden';
    import { normalizeColor } from '$lib/file-colors';
    import { isHidden } from '$lib/file-visibility';
    import {
        elementId,
        isInClipboard,
        isSelected,
        selectedElementIds,
        selectionSize,
        type FileTreeNode,
    } from '$lib/selection-helpers';
    // TODO centering on the selection and the waypoint popup still work on the previous
    // implementation
    import { boundsManager } from '$lib/logic/bounds';
    // import { gpxLayers } from '$lib/components/map/gpx-layer/gpx-layers';
    // import { fileStateCollection } from '$lib/logic/file-state';
    // import { waypointPopup } from '$lib/components/map/gpx-layer/gpx-layer-popup';

    let {
        fileState,
        node,
        label,
    }: {
        fileState: FileState;
        node: FileTreeNode;
        label: string | undefined;
    } = $props();

    const { selection, clipboard, canPaste } = engine;

    let orientation = getContext<'vertical' | 'horizontal'>('orientation');
    let embedding = getContext<boolean>('embedding');

    const levels = {
        file: ListLevel.FILE,
        track: ListLevel.TRACK,
        segment: ListLevel.SEGMENT,
        waypoints: ListLevel.WAYPOINTS,
        waypoint: ListLevel.WAYPOINT,
    };
    let level = $derived(levels[node.type]);

    let singleSelection = $derived(selectionSize($selection) === 1);

    let nodeColors: string[] = $derived.by(() => {
        const { tracks } = fileState.structure;
        if (node.type === 'file') {
            // the colors defined by the tracks, or else the one of the file
            const colors = [
                ...new Set(
                    tracks.flatMap((track) =>
                        track.color !== undefined ? [normalizeColor(track.color)] : []
                    )
                ),
            ];
            return colors.length > 0 ? colors : [fileState.color];
        } else if (node.type === 'track') {
            const color = tracks.find((track) => track.id === node.trackId)?.color;
            return [color !== undefined ? normalizeColor(color) : fileState.color];
        }
        return [];
    });

    let symbolKey = $derived(
        node.type === 'waypoint'
            ? getSymbolKey(fileState.structure.waypoints.find((w) => w.id === node.waypointId)?.sym)
            : undefined
    );

    let selected = $derived(isSelected($selection, node));
    let openEditMetadata: boolean = $derived(editMetadata.current && singleSelection && selected);
    let openEditStyle: boolean = $derived(
        editStyle.current &&
            selected &&
            selectedElementIds($selection)[0]?.ids[0] === elementId(node)
    );

    let hidden = $derived(isHidden(fileState, elementId(node)));
    // cut elements are greyed until they are pasted
    let isCut = $derived($clipboard?.cut === true && isInClipboard($clipboard, node));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<ContextMenu.Root
    onOpenChange={(open) => {
        if (open) {
            if (!selected) {
                engine.selectNode(node);
            }
        }
    }}
>
    <ContextMenu.Trigger class="grow truncate">
        <Button
            variant="ghost"
            class="relative w-full p-0 overflow-hidden border-none focus-visible:ring-0 focus-visible:ring-offset-0 flex flex-row {orientation ===
            'vertical'
                ? 'h-7'
                : 'h-9 px-1.5'} pointer-events-auto"
        >
            {#if node.type === 'file' || node.type === 'track'}
                <MetadataDialog bind:open={openEditMetadata} {fileState} {node} />
                <StyleDialog bind:open={openEditStyle} {fileState} {node} />
            {/if}
            {#if level === ListLevel.FILE || level === ListLevel.TRACK}
                <div
                    class="absolute {orientation === 'vertical'
                        ? 'top-0 bottom-0 right-0 w-1'
                        : 'top-0 h-1 left-0 right-0'}"
                    style="background:linear-gradient(to {orientation === 'vertical'
                        ? 'bottom'
                        : 'right'},{nodeColors
                        .map(
                            (c, i) =>
                                `${c} ${Math.floor((100 * i) / nodeColors.length)}% ${Math.floor((100 * (i + 1)) / nodeColors.length)}%`
                        )
                        .join(',')})"
                ></div>
            {/if}
            <span
                class="grow text-left truncate ml-1 flex flex-row items-center {hidden
                    ? 'text-muted-foreground'
                    : ''} {isCut ? 'text-muted-foreground' : ''}"
                oncontextmenu={(e) => {
                    if (embedding) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    if (e.ctrlKey) {
                        // Add to selection instead of opening context menu
                        e.preventDefault();
                        e.stopPropagation();
                        engine.selectNode(node, 'toggle');
                    }
                }}
                onmouseenter={() => {
                    // TODO waypoint popup: it needs the waypoint of the previous implementation
                    // if (node.type === 'waypoint') {
                    //     let layer = gpxLayers.getLayer(node.fileId);
                    //     let file = fileStateCollection.getFile(node.fileId);
                    //     if (layer && file) {
                    //         let waypoint = file.wpt[waypointIndex];
                    //         if (waypoint && !waypoint._data.hidden) {
                    //             waypointPopup?.setItem({ item: waypoint, fileId: node.fileId });
                    //         }
                    //     }
                    // }
                }}
                onmouseleave={() => {
                    // TODO waypoint popup
                    // if (node.type === 'waypoint') {
                    //     let layer = gpxLayers.getLayer(node.fileId);
                    //     if (layer) {
                    //         waypointPopup?.setItem(null);
                    //     }
                    // }
                }}
            >
                {#if level === ListLevel.SEGMENT}
                    <Waypoints size="16" class="mx-1 shrink-0" />
                {:else if level === ListLevel.WAYPOINT}
                    {#if symbolKey && symbols[symbolKey].icon}
                        {@const SymbolIcon = symbols[symbolKey].icon}
                        <SymbolIcon size="16" class="mx-1 shrink-0" />
                    {:else}
                        <MapPin size="16" class="mx-1 shrink-0" />
                    {/if}
                {/if}
                <span
                    class="grow select-none truncate {orientation === 'vertical'
                        ? 'last:mr-2'
                        : ''}"
                >
                    {label}
                </span>
                {#if hidden}
                    <EyeOff
                        size="10"
                        class="shrink-0 size-3.5 ml-1 {orientation === 'vertical'
                            ? 'mr-3'
                            : 'mt-0.5'}"
                    />
                {/if}
            </span>
        </Button>
    </ContextMenu.Trigger>
    <ContextMenu.Content>
        {#if node.type === 'file' || node.type === 'track'}
            <ContextMenu.Item
                disabled={!singleSelection}
                onclick={() => (editMetadata.current = true)}
            >
                <Info size="16" />
                {i18n._('menu.metadata.button')}
                <Shortcut key="I" ctrl={true} />
            </ContextMenu.Item>
            <ContextMenu.Item onclick={() => (editStyle.current = true)}>
                <PaintBucket size="16" />
                {i18n._('menu.style.button')}
            </ContextMenu.Item>
        {/if}
        <ContextMenu.Item onclick={() => engine.setSelectionHidden(!$allHidden)}>
            {#if $allHidden}
                <Eye size="16" />
                {i18n._('menu.unhide')}
            {:else}
                <EyeOff size="16" />
                {i18n._('menu.hide')}
            {/if}
            <Shortcut key="H" ctrl={true} />
        </ContextMenu.Item>
        <ContextMenu.Separator />
        {#if orientation === 'vertical'}
            {#if node.type === 'file'}
                <ContextMenu.Item disabled={!singleSelection} onclick={() => engine.newTrack()}>
                    <Plus size="16" />
                    {i18n._('menu.new_track')}
                </ContextMenu.Item>
                <ContextMenu.Separator />
            {:else if node.type === 'track'}
                <ContextMenu.Item
                    disabled={!singleSelection}
                    onclick={() => engine.newTrackSegment()}
                >
                    <Plus size="16" />
                    {i18n._('menu.new_segment')}
                </ContextMenu.Item>
                <ContextMenu.Separator />
            {/if}
        {/if}
        {#if level !== ListLevel.WAYPOINTS}
            <ContextMenu.Item onclick={() => engine.selectAll()}>
                <FileStack size="16" />
                {i18n._('menu.select_all')}
                <Shortcut key="A" ctrl={true} />
            </ContextMenu.Item>
        {/if}
        <ContextMenu.Item onclick={() => boundsManager.centerMapOnSelection()}>
            <Maximize size="16" />
            {i18n._('menu.center')}
            <Shortcut key="⏎" ctrl={true} />
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item onclick={() => engine.duplicate()}>
            <Copy size="16" />
            {i18n._('menu.duplicate')}
            <Shortcut key="D" ctrl={true} />
        </ContextMenu.Item>
        {#if orientation === 'vertical'}
            <ContextMenu.Item onclick={() => engine.copy()}>
                <ClipboardCopy size="16" />
                {i18n._('menu.copy')}
                <Shortcut key="C" ctrl={true} />
            </ContextMenu.Item>
            <ContextMenu.Item onclick={() => engine.cut()}>
                <Scissors size="16" />
                {i18n._('menu.cut')}
                <Shortcut key="X" ctrl={true} />
            </ContextMenu.Item>
            <ContextMenu.Item disabled={!$canPaste} onclick={() => engine.paste()}>
                <ClipboardPaste size="16" />
                {i18n._('menu.paste')}
                <Shortcut key="V" ctrl={true} />
            </ContextMenu.Item>
        {/if}
        <ContextMenu.Separator />
        <ContextMenu.Item onclick={() => engine.delete()}>
            <Trash2 size="16" />
            {i18n._('menu.delete')}
            <Shortcut key="⌫" ctrl={true} />
        </ContextMenu.Item>
    </ContextMenu.Content>
</ContextMenu.Root>
