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
        FileX,
        Route,
    } from '@lucide/svelte';
    import { getContext, untrack } from 'svelte';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import MetadataDialog from '$lib/components/file-list/metadata/MetadataDialog.svelte';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import StyleDialog from '$lib/components/file-list/style/StyleDialog.svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { getSymbolKey, symbols } from '$lib/data/symbols';
    import { engine, type FileState } from '$lib/engine';
    import { allHidden } from '$lib/engine/all-hidden';
    import { normalizeColor } from '$lib/engine/file-colors';
    import { isHidden } from '$lib/engine/file-visibility';
    import {
        elementId,
        isInClipboard,
        isSelected,
        pathInfo,
        selectedElementIds,
        selectedFileIds,
        selectionSize,
        type FileTreeNode,
    } from '$lib/engine/selection-helpers';
    import { boundsManager } from '$lib/state/bounds';
    import { closeFiles } from '$lib/actions/file-actions';
    import { waypointPopup } from '$lib/components/map/gpx-layer/gpx-layer-popup';

    let {
        fileState,
        node,
        label,
    }: {
        fileState: FileState;
        node: FileTreeNode;
        label: string | undefined;
    } = $props();

    const { selection, clipboard, canPaste, workspace } = engine;

    let orientation = getContext<'vertical' | 'horizontal'>('orientation');
    let embedding = getContext<boolean>('embedding');

    let level = $derived(node.type);

    let singleSelection = $derived(selectionSize($selection) === 1);

    // a route or a track: it has a name, a description and a style, like a file
    let isPath = $derived(node.type === 'route' || node.type === 'track');

    let nodeColors: string[] = $derived.by(() => {
        const { routes, tracks } = fileState.structure;
        if (node.type === 'file') {
            // the colors defined by the routes and tracks, or else the one of the file
            const colors = [
                ...new Set(
                    [...routes, ...tracks].flatMap((path) =>
                        path.color !== undefined ? [normalizeColor(path.color)] : []
                    )
                ),
            ];
            return colors.length > 0 ? colors : [fileState.color];
        } else if (isPath) {
            const color = pathInfo(fileState.structure, node)?.color;
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
    $effect(() => {
        // the file is open for good once its info or its appearance is (the desktop app)
        if (openEditMetadata || openEditStyle) {
            untrack(() => engine.keepPreview([node.fileId]));
        }
    });

    // the desktop app: the files are linked to the file system, they are closed rather than deleted
    let desktop = $derived($workspace !== undefined);

    // the file is not the one on the disk (the desktop app)
    let unsaved = $derived(node.type === 'file' && $workspace?.files[node.fileId]?.dirty === true);
    // the file is open as a preview, which the next one replaces (the desktop app)
    let preview = $derived(
        node.type === 'file' && $workspace?.files[node.fileId]?.preview === true
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
            // the file is open for good once its menu is (the desktop app)
            engine.keepPreview([node.fileId]);
            if (!selected) {
                engine.selectNode(node);
            }
        }
    }}
>
    <!-- A tab of the horizontal list is as wide as its content, said explicitly: a width that is a
         percentage of a parent that is as wide as its content is not updated by WebKit when the
         content changes (the indicators come and go) -->
    <!-- it only catches right-clicks: no focus ring when it has the focus (WebKit gives it on a
         click), the selection shows where the arrow keys are -->
    <ContextMenu.Trigger class="outline-none {orientation === 'vertical' ? 'grow truncate' : ''}">
        <Button
            variant="ghost"
            class="relative p-0 overflow-hidden border-none focus-visible:ring-0 focus-visible:ring-offset-0 flex flex-row {orientation ===
            'vertical'
                ? 'w-full h-7'
                : 'w-max h-9 px-1.5'} pointer-events-auto"
        >
            {#if node.type === 'file' || isPath}
                <MetadataDialog bind:open={openEditMetadata} {fileState} {node} />
                <StyleDialog bind:open={openEditStyle} {fileState} {node} />
            {/if}
            {#if level === 'file' || isPath}
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
                class="grow text-left ml-1 flex flex-row items-center {orientation === 'vertical'
                    ? 'truncate'
                    : 'whitespace-nowrap'} {hidden ? 'text-muted-foreground' : ''} {isCut
                    ? 'text-muted-foreground'
                    : ''}"
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
                onmouseenter={async () => {
                    if (node.type === 'waypoint' && !isHidden(fileState, node.waypointId)) {
                        const waypoint = await engine.waypoint(node.fileId, node.waypointId);
                        if (waypoint) {
                            waypointPopup?.setItem({
                                item: waypoint,
                                kind: 'waypoint',
                                fileId: node.fileId,
                            });
                        }
                    }
                }}
                onmouseleave={() => {
                    if (node.type === 'waypoint') {
                        waypointPopup?.setItem(null);
                    }
                }}
            >
                {#if level === 'route'}
                    <Route size="16" class="mx-1 shrink-0" />
                {:else if level === 'segment'}
                    <Waypoints size="16" class="mx-1 shrink-0" />
                {:else if level === 'waypoint'}
                    {#if symbolKey && symbols[symbolKey].icon}
                        {@const SymbolIcon = symbols[symbolKey].icon}
                        <SymbolIcon size="16" class="mx-1 shrink-0" />
                    {:else}
                        <MapPin size="16" class="mx-1 shrink-0" />
                    {/if}
                {/if}
                <!-- a tab of the horizontal list is as wide as its content: the name is not cut -->
                <span
                    class:italic={preview}
                    class="grow select-none {orientation === 'vertical'
                        ? 'truncate last:mr-2'
                        : 'shrink-0'}"
                >
                    {label}
                </span>
                {#if unsaved || hidden}
                    <span
                        class="flex flex-row items-center gap-1 shrink-0 pl-1 {orientation ===
                        'vertical'
                            ? 'mr-3'
                            : ''}"
                    >
                        {#if unsaved}
                            <span class="size-1.5 rounded-full bg-foreground"></span>
                        {/if}
                        {#if hidden}
                            <EyeOff
                                size="10"
                                class="size-3.5 {orientation === 'vertical' ? '' : 'mt-0.5'}"
                            />
                        {/if}
                    </span>
                {/if}
            </span>
        </Button>
    </ContextMenu.Trigger>
    <ContextMenu.Content>
        {#if node.type === 'file' || isPath}
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
                <ContextMenu.Item disabled={!singleSelection} onclick={() => engine.newRoute()}>
                    <Plus size="16" />
                    {i18n._('menu.new_route')}
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
        {#if level !== 'waypoints'}
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
        {#if desktop && node.type === 'file'}
            <ContextMenu.Item onclick={() => closeFiles(selectedFileIds($selection))}>
                <FileX size="16" />
                {i18n._('menu.close')}
                <Shortcut key="W" ctrl={true} />
            </ContextMenu.Item>
        {:else}
            <ContextMenu.Item onclick={() => engine.delete()}>
                <Trash2 size="16" />
                {i18n._('menu.delete')}
                <Shortcut key="⌫" ctrl={true} />
            </ContextMenu.Item>
        {/if}
    </ContextMenu.Content>
</ContextMenu.Root>
