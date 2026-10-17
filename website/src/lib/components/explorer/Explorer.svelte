<script lang="ts">
    import { CollapsibleTree, CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import { ScrollArea } from '$lib/components/ui/scroll-area/index';
    import ExplorerTree from './ExplorerTree.svelte';
    import { stickyRowStyle } from './sticky';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { engine } from '$lib/engine';
    import { folderName } from '$lib/engine/workspace';

    const { workspace } = engine;

    let folder = $derived($workspace?.folder);
</script>

<!--
    The tree of the open folder: its folders and GPX files, one level read at a time. The files are
    opened from it (the file list has the ones that are open).
-->
{#if folder}
    <div class="flex flex-col h-full">
        <div class="px-2 py-1 text-sm font-semibold shrink-0">{i18n._('menu.explorer')}</div>
        <ScrollArea class="grow min-h-0">
            <div class="flex flex-col pl-1 pr-3 pb-1">
                <!-- starts over when another folder is opened -->
                {#key folder}
                    <!-- the folder itself, which is open at first -->
                    <CollapsibleTree side="left" defaultState="open">
                        <CollapsibleTreeNode
                            id="folder"
                            triggerClass="sticky flex items-center bg-background"
                            triggerStyle={stickyRowStyle(0)}
                        >
                            {#snippet trigger()}
                                <span class="grow truncate text-left" title={folder}>
                                    {folderName(folder)}
                                </span>
                            {/snippet}
                            {#snippet content(opened)}
                                <!-- what is in it is only read when it is open -->
                                {#if opened}
                                    <div class="ml-4">
                                        <!-- its folders are closed at first -->
                                        <CollapsibleTree side="left" defaultState="closed">
                                            <ExplorerTree />
                                        </CollapsibleTree>
                                    </div>
                                {/if}
                            {/snippet}
                        </CollapsibleTreeNode>
                    </CollapsibleTree>
                {/key}
            </div>
        </ScrollArea>
    </div>
{/if}
