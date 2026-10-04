<script lang="ts">
    import { ScrollArea } from '$lib/components/ui/scroll-area/index';
    import * as ContextMenu from '$lib/components/ui/context-menu';
    import FileListNodeContent from './FileListNodeContent.svelte';
    import { onMount, setContext } from 'svelte';
    import { ClipboardPaste, FileStack, Plus } from '@lucide/svelte';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { engine } from '$lib/engine';
    import { selectedFileIds } from '$lib/selection-helpers';
    import { createFile } from '$lib/logic/file-actions';

    let {
        orientation,
        recursive = false,
        class: className = '',
        style = '',
    }: {
        orientation: 'vertical' | 'horizontal';
        recursive?: boolean;
        class?: string;
        style?: string;
    } = $props();

    setContext('orientation', orientation);
    setContext('recursive', recursive);

    const { files, selection, canPaste } = engine;

    onMount(() => {
        if (orientation === 'horizontal' && $selection.type !== 'file') {
            // only files can be selected here
            engine.select(selectedFileIds($selection));
        }
    });
</script>

<ScrollArea
    class="shrink-0 {orientation === 'vertical' ? 'p-0 pr-3' : 'h-10 px-1'}"
    {orientation}
    scrollbarXClasses={orientation === 'vertical' ? '' : 'hidden'}
    scrollbarYClasses={orientation === 'vertical' ? '' : ''}
>
    <div
        class="flex {orientation === 'vertical'
            ? 'flex-col py-1 pl-1 min-h-screen'
            : 'flex-row'} {className ?? ''}"
        {style}
    >
        <FileListNodeContent node={null} />
        {#if orientation === 'vertical'}
            <ContextMenu.Root>
                <ContextMenu.Trigger class="grow" />
                <ContextMenu.Content>
                    <ContextMenu.Item onclick={createFile}>
                        <Plus size="16" />
                        {i18n._('menu.new_file')}
                        <Shortcut key="+" ctrl={true} />
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item
                        onclick={() => engine.selectAll()}
                        disabled={$files.size === 0}
                    >
                        <FileStack size="16" />
                        {i18n._('menu.select_all')}
                        <Shortcut key="A" ctrl={true} />
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item disabled={!$canPaste} onclick={() => engine.paste()}>
                        <ClipboardPaste size="16" />
                        {i18n._('menu.paste')}
                        <Shortcut key="V" ctrl={true} />
                    </ContextMenu.Item>
                </ContextMenu.Content>
            </ContextMenu.Root>
        {/if}
    </div>
</ScrollArea>
