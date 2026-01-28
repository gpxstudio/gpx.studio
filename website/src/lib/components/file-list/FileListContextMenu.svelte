<script lang="ts">
    import * as ContextMenu from '$lib/components/ui/context-menu';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import {
        Copy,
        Info,
        PaintBucket,
        Plus,
        Trash2,
        Eye,
        EyeOff,
        ClipboardCopy,
        ClipboardPaste,
        Maximize,
        Scissors,
        FileStack,
    } from '@lucide/svelte';
    import { ListFileItem, ListLevel, ListTrackItem } from './file-list';
    import { i18n } from '$lib/i18n.svelte';
    import { editMetadata } from '$lib/components/file-list/metadata/utils.svelte';
    import { editStyle } from '$lib/components/file-list/style/utils.svelte';
    import { selection, copied } from '$lib/logic/selection';
    import { fileActions, pasteSelection } from '$lib/logic/file-actions';
    import { allHidden } from '$lib/logic/hidden';
    import { boundsManager } from '$lib/logic/bounds';
    import { allowedPastes } from './sortable-file-list';
    import { fileListContextMenu } from './context-menu-state.svelte';

    let {
        orientation,
    }: {
        orientation: 'vertical' | 'horizontal';
    } = $props();

    // Anchor element for positioning the context menu
    let anchorEl: HTMLDivElement;

    // Reactive references to the context menu state
    let item = $derived(fileListContextMenu.item);
    let node = $derived(fileListContextMenu.node);
    let menuOpen = $derived(fileListContextMenu.open);

    let singleSelection = $derived($selection.size === 1);

    function handleOpenChange(open: boolean) {
        if (!open) {
            fileListContextMenu.close();
        }
    }
</script>

<!-- Invisible anchor element that follows the mouse position -->
<div
    bind:this={anchorEl}
    style="position: fixed; left: {fileListContextMenu.position.x}px; top: {fileListContextMenu
        .position.y}px; width: 1px; height: 1px; pointer-events: none;"
></div>

<!-- Single shared context menu for the entire file list -->
<ContextMenu.Root open={menuOpen} onOpenChange={handleOpenChange}>
    <!-- Hidden trigger required by bits-ui -->
    <ContextMenu.Trigger style="display: none; outline: none;" tabindex={-1} />
    <ContextMenu.Content customAnchor={anchorEl} class="outline-none" preventScroll={false}>
        {#if item !== null && node !== null}
            {#if item instanceof ListFileItem || item instanceof ListTrackItem}
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
            <ContextMenu.Item
                onclick={() => {
                    if ($allHidden) {
                        fileActions.setHiddenToSelection(false);
                    } else {
                        fileActions.setHiddenToSelection(true);
                    }
                }}
            >
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
                {#if item instanceof ListFileItem}
                    <ContextMenu.Item
                        disabled={!singleSelection}
                        onclick={() => fileActions.addNewTrack(item.getFileId())}
                    >
                        <Plus size="16" />
                        {i18n._('menu.new_track')}
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                {:else if item instanceof ListTrackItem}
                    <ContextMenu.Item
                        disabled={!singleSelection}
                        onclick={() =>
                            fileActions.addNewSegment(item.getFileId(), item.getTrackIndex())}
                    >
                        <Plus size="16" />
                        {i18n._('menu.new_segment')}
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                {/if}
            {/if}
            {#if item.level !== ListLevel.WAYPOINTS}
                <ContextMenu.Item onclick={() => selection.selectAll()}>
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
            <ContextMenu.Item onclick={fileActions.duplicateSelection}>
                <Copy size="16" />
                {i18n._('menu.duplicate')}
                <Shortcut key="D" ctrl={true} />
            </ContextMenu.Item>
            {#if orientation === 'vertical'}
                <ContextMenu.Item onclick={() => selection.copySelection()}>
                    <ClipboardCopy size="16" />
                    {i18n._('menu.copy')}
                    <Shortcut key="C" ctrl={true} />
                </ContextMenu.Item>
                <ContextMenu.Item onclick={() => selection.cutSelection()}>
                    <Scissors size="16" />
                    {i18n._('menu.cut')}
                    <Shortcut key="X" ctrl={true} />
                </ContextMenu.Item>
                <ContextMenu.Item
                    disabled={$copied === undefined ||
                        $copied.length === 0 ||
                        !allowedPastes[$copied[0].level].includes(item.level)}
                    onclick={pasteSelection}
                >
                    <ClipboardPaste size="16" />
                    {i18n._('menu.paste')}
                    <Shortcut key="V" ctrl={true} />
                </ContextMenu.Item>
            {/if}
            <ContextMenu.Separator />
            <ContextMenu.Item onclick={fileActions.deleteSelection}>
                <Trash2 size="16" />
                {i18n._('menu.delete')}
                <Shortcut key="⌫" ctrl={true} />
            </ContextMenu.Item>
        {/if}
    </ContextMenu.Content>
</ContextMenu.Root>
