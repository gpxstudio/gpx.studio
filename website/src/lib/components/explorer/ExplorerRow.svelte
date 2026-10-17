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
    import type { Snippet } from 'svelte';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import { engine } from '$lib/engine';
    import { fileIdAt } from '$lib/engine/workspace';
    import { closeFiles, closeFolder } from '$lib/actions/file-actions';
    import { isMac } from '$lib/utils';
    import { openFiles, showError } from './actions';
    import {
        clickedInExplorer,
        creating,
        dragging,
        editableName,
        explorerSelection,
        isWithin,
        renaming,
    } from './state.svelte';

    let {
        path,
        name,
        kind,
        onOpenFolder,
        icon,
        class: className = '',
        style = '',
    }: {
        path: string;
        /** What the row shows, the name of the file with its extension. */
        name: string;
        /** The open folder itself, a folder in it, or a GPX file. */
        kind: 'root' | 'folder' | 'file';
        /** Opens the folder of the row, to show what was made in it. */
        onOpenFolder?: () => void;
        icon?: Snippet;
        class?: string;
        style?: string;
    } = $props();

    const { workspace } = engine;

    let row: HTMLElement | undefined = $state();

    // the open file of the row
    let fileId = $derived(kind === 'file' ? fileIdAt($workspace, path) : undefined);
    let selected = $derived(explorerSelection.paths.includes(path));
    let editing = $derived(renaming.path === path);
    let target = $derived(dragging.target === path);

    /** The rows of the tree, as they are shown. */
    function rows(): HTMLElement[] {
        const tree = row?.closest('[data-explorer]');
        return tree ? [...tree.querySelectorAll<HTMLElement>('[data-explorer-path]')] : [];
    }

    /** Whether a path of the tree is a GPX file, a folder, or the open folder. */
    function kindOf(other: string): string | undefined {
        return rows().find((r) => r.dataset.explorerPath === other)?.dataset.kind;
    }

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
            const paths = rows()
                .filter((r) => r.dataset.kind !== 'root')
                .map((r) => r.dataset.explorerPath!);
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
                    openFiles([path], true);
                }
            }
        }
    }

    function ondblclick() {
        if (kind === 'file' && !editing) {
            clickedInExplorer.path = path;
            openFiles([path], false);
        }
    }

    // the menu

    /** The folder where what is made from the menu goes: the folder of the row. */
    let folder = $derived(kind === 'file' ? undefined : path);

    /** Asks for the name of a file or a folder to make in the folder of the row (see `creating`). */
    function create(what: 'file' | 'folder') {
        if (folder === undefined) return;
        onOpenFolder?.();
        creating.kind = what;
        creating.parent = folder;
    }

    function openSelected() {
        const files = targets().filter((other) => kindOf(other) === 'file');
        if (files.length > 0) {
            openFiles(files, false);
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
            showError();
        }
    }

    // renaming, in the row

    async function commit(value: string) {
        if (renaming.path !== path) return;
        renaming.path = undefined;
        const name_ = value.trim();
        if (name_ === '' || name_ === editableName(name, kind !== 'file')) return;
        if (!(await engine.renamePath(path, name_))) {
            showError();
        }
    }

    function onkeydown(event: KeyboardEvent) {
        // not for the folder row it is in, which would open or close
        event.stopPropagation();
        const input = event.currentTarget as HTMLInputElement;
        if (event.key === 'Enter') {
            commit(input.value);
        } else if (event.key === 'Escape') {
            renaming.path = undefined;
        }
    }

    function focus(input: HTMLInputElement) {
        input.focus();
        input.select();
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

    function ondragover(event: DragEvent) {
        if (kind === 'file' || dragging.paths.length === 0) return;
        // not into itself
        if (dragging.paths.some((dragged) => isWithin(path, dragged))) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        dragging.target = path;
    }

    function ondragleave(event: DragEvent) {
        if (dragging.target === path && !row?.contains(event.relatedTarget as Node | null)) {
            dragging.target = undefined;
        }
    }

    async function ondrop(event: DragEvent) {
        event.preventDefault();
        const paths = dragging.paths;
        ondragend();
        if (paths.length > 0 && !(await engine.movePaths(paths, path))) {
            showError();
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
            class="flex flex-row items-center gap-1.5 min-w-0 rounded-md {selected
                ? 'bg-accent'
                : ''} {target ? 'ring-1 ring-primary bg-accent/60' : ''} {className}"
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
                <input
                    class="h-6 grow min-w-0 px-1 text-sm font-normal not-italic bg-background border rounded outline-none"
                    value={editableName(name, kind !== 'file')}
                    {@attach focus}
                    {onkeydown}
                    onkeyup={(event) => event.stopPropagation()}
                    onclick={(event) => event.stopPropagation()}
                    onblur={(event) => commit(event.currentTarget.value)}
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
