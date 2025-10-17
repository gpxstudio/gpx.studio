<script lang="ts">
    import { ScrollArea } from '$lib/components/ui/scroll-area/index';
    import * as ContextMenu from '$lib/components/ui/context-menu';
    import FileListNode from './FileListNode.svelte';
    import { setContext } from 'svelte';
    import { ListFileItem, ListLevel, ListRootItem, allowedPastes } from './file-list';
    import { ClipboardPaste, FileStack, Plus } from '@lucide/svelte';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { settings } from '$lib/logic/settings';
    import { fileStateCollection } from '$lib/logic/file-state';
    import { createFile, pasteSelection } from '$lib/logic/file-actions';
    import { selection } from '$lib/logic/selection';

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

    const { treeFileView } = settings;

    // treeFileView.subscribe(($vertical) => {
    //     if ($vertical) {
    //         selection.update(($selection) => {
    //             $selection.forEach((item) => {
    //                 if ($selection.hasAnyChildren(item, false)) {
    //                     $selection.toggle(item);
    //                 }
    //             });
    //             return $selection;
    //         });
    //     } else {
    //         selection.update(($selection) => {
    //             $selection.forEach((item) => {
    //                 if (!(item instanceof ListFileItem)) {
    //                     $selection.toggle(item);
    //                     $selection.set(new ListFileItem(item.getFileId()), true);
    //                 }
    //             });
    //             return $selection;
    //         });
    //     }
    // });
</script>

<ScrollArea
    class="shrink-0 {orientation === 'vertical' ? 'p-0 pr-3' : 'h-10 px-1'}"
    {orientation}
    scrollbarXClasses={orientation === 'vertical' ? '' : 'mt-1 h-2'}
    scrollbarYClasses={orientation === 'vertical' ? '' : ''}
>
    <div
        class="flex {orientation === 'vertical'
            ? 'flex-col py-1 pl-1 min-h-screen'
            : 'flex-row'} {className ?? ''}"
        {style}
    >
        <FileListNode node={$fileStateCollection} item={new ListRootItem()} />
        {#if orientation === 'vertical'}
            <ContextMenu.Root>
                <ContextMenu.Trigger class="grow" />
                <ContextMenu.Content>
                    <ContextMenu.Item onclick={createFile}>
                        <Plus size="16" class="mr-1" />
                        {i18n._('menu.new_file')}
                        <Shortcut key="+" ctrl={true} />
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item
                        onclick={() => selection.selectAll()}
                        disabled={$fileStateCollection.size === 0}
                    >
                        <FileStack size="16" class="mr-1" />
                        {i18n._('menu.select_all')}
                        <Shortcut key="A" ctrl={true} />
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                    <ContextMenu.Item
                        disabled={selection.copied === undefined ||
                            selection.copied.length === 0 ||
                            !allowedPastes[selection.copied[0].level].includes(ListLevel.ROOT)}
                        onclick={pasteSelection}
                    >
                        <ClipboardPaste size="16" class="mr-1" />
                        {i18n._('menu.paste')}
                        <Shortcut key="V" ctrl={true} />
                    </ContextMenu.Item>
                </ContextMenu.Content>
            </ContextMenu.Root>
        {/if}
    </div>
</ScrollArea>
