<script lang="ts">
    import { setContext, untrack } from 'svelte';
    import { CollapsibleTree, CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import { CollapsibleTreeState } from '$lib/components/collapsible-tree/utils.svelte';
    import { ScrollArea } from '$lib/components/ui/scroll-area/index';
    import ExplorerTree from './ExplorerTree.svelte';
    import ExplorerRow from './ExplorerRow.svelte';
    import {
        clickedInExplorer,
        explorerFoldersKey,
        explorerSelection,
        renaming,
        treeRows,
        type ExplorerFolders,
    } from './state.svelte';
    import { openPaths } from '$lib/actions/file-actions';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { engine } from '$lib/engine';
    import { selectedFileIds } from '$lib/engine/selection-helpers';
    import { folderName, parentOf, subfolder } from '$lib/engine/workspace';

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

    // the files that are selected, if they are in the folder
    let selectedPaths = $derived(
        selectedFileIds($selection)
            .map((id) => $workspace?.files[id]?.path)
            .filter((path): path is string => subfolder(folder, path) !== undefined)
    );
    let selectedPath = $derived(selectedPaths[0]);

    $effect(() => {
        // not what the click that was just made depends on, only the selection and the folder
        const clicked = untrack(() => clickedInExplorer.path);
        if (clicked !== undefined && selectedPath === clicked) {
            return;
        }
        clickedInExplorer.path = undefined;
        // what is selected elsewhere (the file list, the map) is selected here
        explorerSelection.paths = untrack(() => selectedPaths);
        explorerSelection.anchor = selectedPath;
        if (folder && selectedPath !== undefined) {
            return reveal(folder, selectedPath);
        }
    });

    /**
     * Opens the folders that hold a file and scrolls to the file, if it is not in view already. Its
     * row may not be there yet, because the content of a folder is read when it is opened.
     */
    function reveal(folder: string, path: string) {
        openFolder(parentOf(path));
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

    /**
     * The id of the node of a folder of the tree in `trees.folders`: the names of the folders it is
     * in, and its own (see `CollapsibleTreeNode`). `undefined` for the open folder itself, which is
     * in `trees.root`, and for what is not in it.
     */
    function nodeId(path: string): string | undefined {
        const names = subfolder(folder, `${path}/_`)?.split('/').filter(Boolean);
        return names && names.length > 0 ? ['root', ...names].join('.') : undefined;
    }

    /** Opens a folder of the tree, and the folders it is in. */
    function openFolder(path: string) {
        if (!trees) return;
        trees.root.get('root.folder').current = true;
        const id = nodeId(path);
        if (id === undefined) return;
        const names = id.split('.');
        names.forEach((_, i) => {
            if (i > 0) trees!.folders.get(names.slice(0, i + 1).join('.')).current = true;
        });
    }

    setContext<ExplorerFolders>(explorerFoldersKey, {
        open: openFolder,
        moved(from, to) {
            const [fromId, toId] = [nodeId(from), nodeId(to)];
            if (trees && fromId !== undefined && toId !== undefined) {
                trees.folders.move(fromId, toId);
            }
        },
    });

    /** Enter opens the selected files for good. */
    function onkeydown(event: KeyboardEvent) {
        if (renaming.path !== undefined || event.key !== 'Enter') return;
        const files = treeRows(container)
            .filter((row) => row.kind === 'file' && explorerSelection.paths.includes(row.path))
            .map((row) => row.path);
        if (files.length > 0) {
            openPaths(files);
            event.preventDefault();
        }
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
            <div
                bind:this={container}
                data-explorer
                role="tree"
                tabindex="0"
                class="flex flex-col pl-1 pr-3 pb-1 outline-none"
                {onkeydown}
            >
                <!-- starts over when another folder is opened -->
                {#key folder}
                    <!-- the folder itself -->
                    <CollapsibleTree side="left" treeState={trees.root} sticky>
                        <CollapsibleTreeNode id="folder">
                            {#snippet trigger()}
                                <ExplorerRow
                                    path={folder}
                                    name={folderName(folder)}
                                    kind="root"
                                    class="h-7"
                                />
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

<style lang="postcss">
    @reference "../../../app.css";

    /* the color of the file list: a file and a folder (the whole row of its node, with its
       chevron) under the pointer, or selected */
    [data-explorer] :global([data-kind='file']:hover),
    [data-explorer] :global([data-slot='button']:hover),
    [data-explorer] :global([data-kind='file'][aria-selected='true']),
    [data-explorer] :global([data-slot='button']:has([aria-selected='true'])) {
        @apply bg-[var(--selection)];
    }

    /* the folder where what is dragged would go */
    [data-explorer] :global([data-slot='button']:has([data-drop-target])) {
        @apply ring-1 ring-primary bg-[var(--selection)];
    }
</style>
