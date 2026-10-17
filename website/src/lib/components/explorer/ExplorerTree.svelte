<script lang="ts">
    import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import { Button } from '$lib/components/ui/button';
    import { FileText } from '@lucide/svelte';
    import ExplorerTree from './ExplorerTree.svelte';
    import { stickyRowStyle } from './sticky';
    import { openPath } from '$lib/actions/file-actions';
    import { engine, type FolderEntry } from '$lib/engine';
    import { selectedFileIds } from '$lib/engine/selection-helpers';
    import { fileIdAt } from '$lib/engine/workspace';

    let {
        path,
        depth = 1,
    }: {
        /** The folder whose content is listed, the open folder if it is not given. */
        path?: string;
        /** How many folders deep the folders listed are (the open folder is 0). */
        depth?: number;
    } = $props();

    const { workspace, selection, folderVersion } = engine;

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
        if (id !== undefined) {
            engine.select([id]);
        } else {
            openPath(entry.path);
        }
    }
</script>

{#each entries as entry (entry.path)}
    {#if entry.isDir}
        <CollapsibleTreeNode
            id={entry.name}
            triggerClass="sticky flex items-center bg-background"
            triggerStyle={stickyRowStyle(depth)}
        >
            {#snippet trigger()}
                <span class="grow truncate text-left">{entry.name}</span>
            {/snippet}
            {#snippet content(opened)}
                <!-- the content of a folder is only read when it is opened -->
                {#if opened}
                    <div class="ml-4">
                        <ExplorerTree path={entry.path} depth={depth + 1} />
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
            onclick={() => open(entry, id)}
        >
            <FileText size="16" class="shrink-0" />
            <span class="grow truncate text-left">{entry.name}</span>
        </Button>
    {/if}
{/each}
