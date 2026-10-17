<script lang="ts">
    import { untrack } from 'svelte';
    import { CollapsibleTree, CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import { CollapsibleTreeState } from '$lib/components/collapsible-tree/utils.svelte';
    import { ScrollArea } from '$lib/components/ui/scroll-area/index';
    import ExplorerTree from './ExplorerTree.svelte';
    import { clickedInExplorer } from './state.svelte';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { engine } from '$lib/engine';
    import { selectedFileIds } from '$lib/engine/selection-helpers';
    import { folderName, subfolder } from '$lib/engine/workspace';

    const { workspace, selection } = engine;

    let folder = $derived($workspace?.folder);

    // which folders are open: new ones when another folder is opened, the folder itself is open at
    // first and its folders are closed
    let trees = $derived(
        folder
            ? {
                  root: new CollapsibleTreeState('open'),
                  folders: new CollapsibleTreeState('closed'),
              }
            : undefined
    );

    let container: HTMLElement | undefined = $state();

    // the file that is selected, if it is in the folder
    let selectedPath = $derived.by(() => {
        const id = selectedFileIds($selection)[0];
        const path = id === undefined ? undefined : $workspace?.files[id]?.path;
        return subfolder(folder, path) === undefined ? undefined : path;
    });

    $effect(() => {
        // not what the click that was just made depends on, only the selection and the folder
        const clicked = untrack(() => clickedInExplorer.path);
        if (selectedPath === clicked) {
            return;
        }
        clickedInExplorer.path = undefined;
        if (folder && selectedPath !== undefined) {
            return reveal(folder, selectedPath);
        }
    });

    /**
     * Opens the folders that hold a file and scrolls to the file, if it is not in view already. Its
     * row may not be there yet, because the content of a folder is read when it is opened.
     */
    function reveal(folder: string, path: string) {
        if (!trees) {
            return;
        }
        trees.root.get('root.folder').current = true;
        let id = 'root';
        for (const name of subfolder(folder, path)?.split('/').filter(Boolean) ?? []) {
            id += `.${name}`;
            trees.folders.get(id).current = true;
        }
        let frame = 0;
        let attempts = 0;
        const scroll = () => {
            const row = container?.querySelector(`[data-path="${CSS.escape(path)}"]`);
            if (row) {
                row.scrollIntoView({ block: 'nearest' });
            } else if (attempts++ < 120) {
                frame = requestAnimationFrame(scroll);
            }
        };
        frame = requestAnimationFrame(scroll);
        return () => cancelAnimationFrame(frame);
    }
</script>

<!--
    The tree of the open folder: its folders and GPX files, one level read at a time. The files are
    opened from it (the file list has the ones that are open).
-->
{#if folder && trees}
    <div class="flex flex-col h-full">
        <div class="px-2 py-1 text-sm font-semibold shrink-0">{i18n._('menu.explorer')}</div>
        <ScrollArea class="grow min-h-0">
            <div bind:this={container} class="flex flex-col pl-1 pr-3 pb-1">
                <!-- starts over when another folder is opened -->
                {#key folder}
                    <!-- the folder itself -->
                    <CollapsibleTree side="left" treeState={trees.root} sticky>
                        <CollapsibleTreeNode id="folder">
                            {#snippet trigger()}
                                <span class="grow truncate text-left" title={folder}>
                                    {folderName(folder)}
                                </span>
                            {/snippet}
                            {#snippet content(opened)}
                                <!-- what is in it is only read when it is open -->
                                {#if opened}
                                    <div class="ml-4">
                                        <CollapsibleTree side="left" treeState={trees.folders}>
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
