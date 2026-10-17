<script lang="ts">
    import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import { Button } from '$lib/components/ui/button';
    import { FileText } from '@lucide/svelte';
    import { getContext } from 'svelte';
    import { clickedInExplorer } from './state.svelte';
    import { stickyKey, type StickyLevel } from '$lib/components/collapsible-tree/sticky';
    import ExplorerTree from './ExplorerTree.svelte';
    import { openPath } from '$lib/actions/file-actions';
    import { engine, type FolderEntry } from '$lib/engine';
    import { selectedFileIds } from '$lib/engine/selection-helpers';
    import { fileIdAt } from '$lib/engine/workspace';

    let {
        path,
    }: {
        /** The folder whose content is listed, the open folder if it is not given. */
        path?: string;
    } = $props();

    const { workspace, selection, folderVersion } = engine;
    // the rows of the folders that stick above the files of this one
    const level = getContext<StickyLevel>(stickyKey);

    let entries: FolderEntry[] = $state([]);

    $effect(() => {
        // read again when something changed on the file system
        $folderVersion;
        let current = true;
        engine.listFolder(path).then((list) => {
            if (current) {
                entries = list;
            }
        });
        return () => {
            current = false;
        };
    });

    /** Opens the file, or selects it if it is open already. */
    function open(entry: FolderEntry, id: string | undefined) {
        // it is in view, the explorer does not have to scroll to it (which would move the rows
        // under the pointer, and leave the one it was on highlighted)
        clickedInExplorer.path = entry.path;
        if (id !== undefined) {
            engine.select([id]);
        } else {
            openPath(entry.path);
        }
    }
</script>

{#each entries as entry (entry.path)}
    {#if entry.isDir}
        <CollapsibleTreeNode id={entry.name}>
            {#snippet trigger()}
                <span class="grow truncate text-left">{entry.name}</span>
            {/snippet}
            {#snippet content(opened)}
                <!-- the content of a folder is only read when it is opened -->
                {#if opened}
                    <div class="ml-4">
                        <ExplorerTree path={entry.path} />
                    </div>
                {/if}
            {/snippet}
        </CollapsibleTreeNode>
    {:else}
        {@const id = fileIdAt($workspace, entry.path)}
        {@const selected = id !== undefined && selectedFileIds($selection).includes(id)}
        <Button
            variant="ghost"
            class="w-full h-7 px-1 justify-start gap-1.5 border-none font-normal {selected
                ? 'bg-accent'
                : ''} {id === undefined ? 'text-muted-foreground' : ''}"
            title={entry.path}
            data-path={entry.path}
            style="scroll-margin-top: {level.top}px"
            onclick={() => open(entry, id)}
        >
            <FileText size="16" class="shrink-0" />
            <span class="grow truncate text-left">{entry.name}</span>
        </Button>
    {/if}
{/each}
