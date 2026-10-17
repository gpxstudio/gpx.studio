<script lang="ts">
    import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import { FileText, Folder } from '@lucide/svelte';
    import { getContext } from 'svelte';
    import { get } from 'svelte/store';
    import { toast } from 'svelte-sonner';
    import { stickyKey, type StickyLevel } from '$lib/components/collapsible-tree/sticky';
    import ExplorerTree from './ExplorerTree.svelte';
    import ExplorerRow from './ExplorerRow.svelte';
    import { engine, type FolderEntry } from '$lib/engine';
    import { editableName, fileIdAt } from '$lib/engine/workspace';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { currentTool, Tool } from '$lib/components/toolbar/tools';
    import { showEngineError } from '$lib/actions/file-actions';
    import NameInput from './NameInput.svelte';
    import { creating, explorerSelection } from './state.svelte';

    let {
        path,
    }: {
        /** The folder whose content is listed, the open folder if it is not given. */
        path?: string;
    } = $props();

    const { workspace, folderVersion } = engine;
    // the rows of the folders that stick above the files of this one
    const level = getContext<StickyLevel>(stickyKey);

    let entries: FolderEntry[] = $state([]);
    // the nodes of the folders, to open them when something is made in them
    let nodes: Record<string, CollapsibleTreeNode | undefined> = $state({});

    // the folder of the list, where what is being made goes
    let folder = $derived(path ?? $workspace?.folder);
    let pending = $derived(
        creating.parent !== undefined && creating.parent === folder ? creating.kind : undefined
    );
    // the files come after the folders
    let firstFile = $derived(entries.find((entry) => !entry.isDir));

    /**
     * Makes the file or folder that was asked for, called `value`: nothing is made without a name,
     * nor with the name of something that is there (the user is told, and can change it). A new
     * file is selected, for the routing tool.
     */
    async function create(value: string, retry: boolean) {
        const kind = pending;
        const parent = folder;
        if (kind === undefined || parent === undefined) return;
        const name = value.trim();
        const taken = entries.some(
            (entry) =>
                entry.isDir === (kind === 'folder') &&
                editableName(entry.name, entry.isDir).toLowerCase() === name.toLowerCase()
        );
        if (name !== '' && taken) {
            toast.error(i18n._('menu.metadata.name_taken'));
            if (retry) return;
        }
        creating.parent = undefined;
        if (name === '' || taken) return;
        let created: string | undefined;
        if (kind === 'file') {
            const id = await engine.newFileIn(name, parent);
            created = id === undefined ? undefined : get(workspace)?.files[id]?.path;
            if (created !== undefined) {
                currentTool.set(Tool.ROUTING);
            }
        } else {
            created = await engine.createFolder(parent, name);
        }
        if (created === undefined) {
            showEngineError();
            return;
        }
        explorerSelection.paths = [created];
        explorerSelection.anchor = created;
    }

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
</script>

<!-- the name of what is being made, which it is made with -->
{#snippet named(kind: 'file' | 'folder')}
    <div class="flex flex-row items-center h-7 pl-1 pr-1 {kind === 'file' ? 'gap-1.5' : 'gap-1'}">
        {#if kind === 'file'}
            <FileText size="16" class="shrink-0" />
        {:else}
            <Folder size="16" class="shrink-0" />
        {/if}
        <NameInput
            placeholder={i18n._(
                kind === 'file' ? 'menu.explorer_menu.new_file' : 'menu.explorer_menu.new_folder'
            )}
            oncommit={create}
            oncancel={() => (creating.parent = undefined)}
        />
    </div>
{/snippet}

{#if pending === 'folder'}
    {@render named('folder')}
{/if}
{#each entries as entry (entry.path)}
    {#if pending === 'file' && entry === firstFile}
        {@render named('file')}
    {/if}
    {#if entry.isDir}
        <CollapsibleTreeNode id={entry.name} bind:this={nodes[entry.path]}>
            {#snippet trigger()}
                <ExplorerRow
                    path={entry.path}
                    name={entry.name}
                    kind="folder"
                    class="h-7"
                    onOpenFolder={() => nodes[entry.path]?.openNode()}
                />
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
        <!-- the files that are not open are greyed -->
        <ExplorerRow
            path={entry.path}
            name={entry.name}
            kind="file"
            class="w-full h-7 px-1 text-sm hover:bg-muted {fileIdAt($workspace, entry.path) ===
            undefined
                ? 'text-muted-foreground'
                : ''}"
            style="scroll-margin-top: {level.top}px"
        >
            {#snippet icon()}
                <FileText size="16" class="shrink-0" />
            {/snippet}
        </ExplorerRow>
    {/if}
{/each}
{#if pending === 'file' && firstFile === undefined}
    {@render named('file')}
{/if}
