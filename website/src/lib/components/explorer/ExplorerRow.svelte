<script lang="ts">
    import * as ContextMenu from '$lib/components/ui/context-menu';
    import {
        ExternalLink,
        FileX,
        FolderOpen,
        FolderX,
        PencilLine,
        Plus,
        Trash2,
    } from '@lucide/svelte';
    import { getContext, type Snippet } from 'svelte';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { engine } from '$lib/engine';
    import { editableName, fileIdAt, isWithin, parentOf, relocated } from '$lib/engine/workspace';
    import { closeFiles, closeFolder, openPaths, showEngineError } from '$lib/actions/file-actions';
    import { isMac } from '$lib/utils';
    import NameInput from './NameInput.svelte';
    import {
        clickedInExplorer,
        creating,
        dragging,
        explorerFoldersKey,
        explorerSelection,
        renaming,
        treeRows,
        type ExplorerFolders,
    } from './state.svelte';

    let {
        path,
        name,
        kind,
        icon,
        class: className = '',
        style = '',
    }: {
        path: string;
        /** What the row shows, the name of the file with its extension. */
        name: string;
        /** The open folder itself, a folder in it, or a GPX file. */
        kind: 'root' | 'folder' | 'file';
        icon?: Snippet;
        class?: string;
        style?: string;
    } = $props();

    const { workspace } = engine;
    const folders = getContext<ExplorerFolders>(explorerFoldersKey);

    let row: HTMLElement | undefined = $state();

    // the open file of the row
    let fileId = $derived(kind === 'file' ? fileIdAt($workspace, path) : undefined);
    let selected = $derived(explorerSelection.paths.includes(path));
    let editing = $derived(renaming.path === path);
    let target = $derived(dragging.target === path);

    /** What the menu and dragging act on: the selection, if the row is in it. */
    function targets(): string[] {
        return selected ? explorerSelection.paths : [path];
    }

    function select(paths: string[]) {
        explorerSelection.paths = paths;
        explorerSelection.anchor = path;
    }

    function onclick(event: MouseEvent) {
        if (editing || kind === 'root') {
            return;
        }
        if (event.metaKey || event.ctrlKey) {
            // added to the selection, or taken out of it, without opening anything
            select(
                selected
                    ? explorerSelection.paths.filter((other) => other !== path)
                    : [...explorerSelection.paths, path]
            );
            event.preventDefault();
            event.stopPropagation();
        } else if (event.shiftKey && explorerSelection.anchor !== undefined) {
            // everything shown between the row where the selection began and this one
            const paths = treeRows(row)
                .filter((other) => other.kind !== 'root')
                .map((other) => other.path);
            const [from, to] = [paths.indexOf(explorerSelection.anchor), paths.indexOf(path)];
            if (from >= 0 && to >= 0) {
                explorerSelection.paths = paths.slice(Math.min(from, to), Math.max(from, to) + 1);
            }
            event.preventDefault();
            event.stopPropagation();
        } else if (event.detail <= 1) {
            select([path]);
            if (kind === 'file') {
                // it is in view, the explorer does not have to scroll to it
                clickedInExplorer.path = path;
                if (fileId !== undefined) {
                    engine.select([fileId]);
                } else {
                    openPaths([path], true);
                }
            }
        }
    }

    function ondblclick() {
        if (kind === 'file' && !editing) {
            clickedInExplorer.path = path;
            openPaths([path], false);
        }
    }

    // the menu

    /** The folder where what is made from the menu goes: the folder of the row. */
    let folder = $derived(kind === 'file' ? undefined : path);

    /** Asks for the name of a file or a folder to make in the folder of the row (see `creating`). */
    function create(what: 'file' | 'folder') {
        if (folder === undefined) return;
        // where what is being named is shown
        folders.open(folder);
        creating.kind = what;
        creating.parent = folder;
    }

    function openSelected() {
        const files = treeRows(row)
            .filter((other) => other.kind === 'file' && targets().includes(other.path))
            .map((other) => other.path);
        if (files.length > 0) {
            openPaths(files);
        }
    }

    /** The open files among what the menu acts on. */
    function openIds(): string[] {
        return targets()
            .map((other) => fileIdAt($workspace, other))
            .filter((id): id is string => id !== undefined);
    }

    async function remove() {
        const paths = targets();
        explorerSelection.paths = [];
        if (!(await engine.deletePaths(paths))) {
            showEngineError();
        }
    }

    // renaming, in the row

    async function commit(value: string) {
        if (renaming.path !== path) return;
        renaming.path = undefined;
        const name_ = value.trim();
        if (name_ === '' || name_ === editableName(name, kind !== 'file')) return;
        // the folder stays open or closed (before its new row is read, back if it is not renamed)
        const to = relocated(path, parentOf(path), name_);
        folders.moved(path, to);
        if (!(await engine.renamePath(path, name_))) {
            folders.moved(to, path);
            showEngineError();
        }
    }

    // dragging into folders

    function ondragstart(event: DragEvent) {
        if (kind === 'root' || editing) {
            event.preventDefault();
            return;
        }
        const paths = targets();
        dragging.paths = paths;
        event.dataTransfer?.setData('text/plain', paths.join('\n'));
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
        }
    }

    function ondragend() {
        dragging.paths = [];
        dragging.target = undefined;
    }

    /** The folder where what is dropped on the row goes: the folder of a file, among its files. */
    let dropFolder = $derived(kind === 'file' ? parentOf(path) : path);

    function ondragover(event: DragEvent) {
        if (dragging.paths.length === 0) return;
        // not into itself, nor where it is already
        if (dragging.paths.some((dragged) => isWithin(dropFolder, dragged))) return;
        if (dragging.paths.every((dragged) => parentOf(dragged) === dropFolder)) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        // the row of the folder shows it
        dragging.target = dropFolder;
    }

    function ondragleave(event: DragEvent) {
        // to another row, which tells where it would go (it was entered first)
        const to = event.relatedTarget as Element | null;
        if (to?.closest?.('[data-explorer-path]')) return;
        dragging.target = undefined;
    }

    async function ondrop(event: DragEvent) {
        event.preventDefault();
        const paths = dragging.paths;
        ondragend();
        if (paths.length === 0) return;
        // the folders stay open or closed (before their new rows are read, back if they are not moved)
        const moves = paths.map((dragged) => [dragged, relocated(dragged, dropFolder)]);
        moves.forEach(([from, to]) => folders.moved(from, to));
        if (await engine.movePaths(paths, dropFolder)) {
            // where they went is shown
            folders.open(dropFolder);
        } else {
            moves.forEach(([from, to]) => folders.moved(to, from));
            showEngineError();
        }
    }
</script>

<ContextMenu.Root
    onOpenChange={(open) => {
        if (open && !selected && kind !== 'root') {
            select([path]);
        }
    }}
>
    <ContextMenu.Trigger class="grow min-w-0 pointer-events-auto">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            bind:this={row}
            role="treeitem"
            aria-selected={selected}
            tabindex="-1"
            data-explorer-path={path}
            data-path={path}
            data-kind={kind}
            title={path}
            draggable={kind !== 'root' && !editing}
            data-drop-target={target || undefined}
            class="flex flex-row items-center gap-1.5 min-w-0 rounded-md {className}"
            {style}
            {onclick}
            {ondblclick}
            {ondragstart}
            {ondragend}
            {ondragover}
            ondragenter={ondragover}
            {ondragleave}
            {ondrop}
        >
            {@render icon?.()}
            {#if editing}
                <NameInput
                    value={editableName(name, kind !== 'file')}
                    oncommit={commit}
                    oncancel={() => (renaming.path = undefined)}
                />
            {:else}
                <span class="grow truncate text-left">{name}</span>
            {/if}
        </div>
    </ContextMenu.Trigger>
    <!-- the name being edited keeps the focus, which the menu would give back to the row -->
    <ContextMenu.Content
        onCloseAutoFocus={(event) => {
            if (renaming.path !== undefined || creating.parent !== undefined) {
                event.preventDefault();
            }
        }}
    >
        {#if kind !== 'file'}
            <ContextMenu.Item onclick={() => create('file')}>
                <Plus size="16" />
                {i18n._('menu.explorer_menu.new_file')}
            </ContextMenu.Item>
            <ContextMenu.Item onclick={() => create('folder')}>
                <Plus size="16" />
                {i18n._('menu.explorer_menu.new_folder')}
            </ContextMenu.Item>
            <ContextMenu.Separator />
        {:else}
            <ContextMenu.Item onclick={openSelected}>
                <FolderOpen size="16" />
                {i18n._('menu.explorer_menu.open')}
            </ContextMenu.Item>
            {#if openIds().length > 0}
                <ContextMenu.Item onclick={() => closeFiles(openIds())}>
                    <FileX size="16" />
                    {i18n._('menu.close')}
                </ContextMenu.Item>
            {/if}
            <ContextMenu.Separator />
        {/if}
        {#if kind !== 'root'}
            <ContextMenu.Item
                disabled={targets().length !== 1}
                onclick={() => (renaming.path = path)}
            >
                <PencilLine size="16" />
                {i18n._('menu.explorer_menu.rename')}
            </ContextMenu.Item>
            <ContextMenu.Item onclick={remove}>
                <Trash2 size="16" />
                {i18n._('menu.delete')}
            </ContextMenu.Item>
            <ContextMenu.Separator />
        {/if}
        <ContextMenu.Item onclick={() => engine.revealPath(path)}>
            <ExternalLink size="16" />
            {i18n._(isMac() ? 'menu.explorer_menu.reveal_finder' : 'menu.explorer_menu.reveal')}
        </ContextMenu.Item>
        {#if kind === 'root'}
            <ContextMenu.Separator />
            <ContextMenu.Item onclick={closeFolder}>
                <FolderX size="16" />
                {i18n._('menu.close_folder')}
            </ContextMenu.Item>
        {/if}
    </ContextMenu.Content>
</ContextMenu.Root>
