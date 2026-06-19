<script lang="ts">
    import { get } from 'svelte/store';
    import {
        projectRegistry,
        activeProjectId,
        createProject,
        renameProject,
        deleteProject,
        MAX_PROJECTS,
        type ProjectMeta,
    } from '$lib/logic/project-registry';
    import { switchToProject, currentDb } from '$lib/logic/active-project';
    import { createProjectDatabase } from '$lib/db';
    import { i18n } from '$lib/i18n.svelte';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import * as ContextMenu from '$lib/components/ui/context-menu';
    import ButtonWithTooltip from '$lib/components/ButtonWithTooltip.svelte';
    import { Plus, X, Pencil, Trash2 } from '@lucide/svelte';

    // ── State ──────────────────────────────────────────────────────────────

    let renamingId: string | null = $state(null);
    let renameValue: string = $state('');
    let deleteConfirmId: string | null = $state(null);
    let renameInputEl: HTMLInputElement | undefined = $state(undefined);

    // ── Derived ───────────────────────────────────────────────────────────

    const atMax = $derived($projectRegistry.length >= MAX_PROJECTS);

    // ── Handlers ──────────────────────────────────────────────────────────

    async function handleTabClick(project: ProjectMeta) {
        if (project.id !== $activeProjectId) {
            await switchToProject(project.id);
        }
    }

    async function handleAddProject() {
        if (atMax) return;
        const newId = await createProject();
        if (newId) {
            await switchToProject(newId);
        }
    }

    function startRename(project: ProjectMeta) {
        renamingId = project.id;
        renameValue = project.name;
        // Focus input after DOM updates
        setTimeout(() => renameInputEl?.focus(), 0);
    }

    async function commitRename() {
        if (renamingId && renameValue.trim()) {
            await renameProject(renamingId, renameValue.trim());
        }
        renamingId = null;
    }

    function cancelRename() {
        renamingId = null;
    }

    async function handleDeleteRequest(project: ProjectMeta) {
        // Check if the target project (not the active one) has files
        let fileCount = 0;
        if (project.id === $activeProjectId) {
            // Active project — use currentDb directly
            const db = get(currentDb);
            if (db) fileCount = await db.fileids.count();
        } else {
            // Inactive project — open its DB temporarily to check
            const db = createProjectDatabase(project.id);
            try {
                fileCount = await db.fileids.count();
            } finally {
                db.close();
            }
        }
        if (fileCount > 0) {
            deleteConfirmId = project.id;
            return;
        }
        // No files — delete immediately
        await performDelete(project.id);
    }

    async function performDelete(id: string) {
        const projects = $projectRegistry;
        const idx = projects.findIndex((p) => p.id === id);
        // Only switch tabs if we're deleting the currently active project
        if (id === $activeProjectId) {
            const nextProject = projects[idx + 1] ?? projects[idx - 1];
            if (nextProject) {
                await switchToProject(nextProject.id);
            }
        }
        await deleteProject(id);
        deleteConfirmId = null;
    }
</script>

<!-- ── Tab bar ──────────────────────────────────────────────────────────── -->
<div class="flex items-center h-8 bg-muted/50 border-b border-border overflow-x-auto shrink-0 select-none">
    {#each $projectRegistry as project (project.id)}
        {@const isActive = project.id === $activeProjectId}
        {@const isRenaming = renamingId === project.id}

        <ContextMenu.Root>
            <ContextMenu.Trigger>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="group relative flex items-center gap-1 px-3 h-8 text-sm cursor-pointer shrink-0 border-r border-border transition-colors
                        {isActive ? 'bg-background font-medium text-foreground' : 'text-muted-foreground hover:bg-background/60'}"
                    onclick={() => handleTabClick(project)}
                    ondblclick={() => startRename(project)}
                >
                    {#if isRenaming}
                        <!-- svelte-ignore a11y_autofocus -->
                        <input
                            bind:this={renameInputEl}
                            bind:value={renameValue}
                            class="w-24 text-sm bg-transparent outline outline-1 outline-ring rounded px-1"
                            onblur={commitRename}
                            onkeydown={(e) => {
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') cancelRename();
                                e.stopPropagation();
                            }}
                            onclick={(e) => e.stopPropagation()}
                        />
                    {:else}
                        <span class="max-w-32 truncate">{project.name}</span>
                    {/if}

                    <!-- Close button (only shown when more than 1 project) -->
                    {#if $projectRegistry.length > 1}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <span
                            class="ml-1 opacity-0 group-hover:opacity-100 rounded hover:bg-muted p-0.5 transition-opacity"
                            onclick={(e) => { e.stopPropagation(); handleDeleteRequest(project); }}
                        >
                            <X size={12} />
                        </span>
                    {/if}
                </div>
            </ContextMenu.Trigger>

            <ContextMenu.Content>
                <ContextMenu.Item onclick={() => startRename(project)}>
                    <Pencil size={14} class="mr-2" />
                    {i18n._('project.rename')}
                </ContextMenu.Item>
                {#if $projectRegistry.length > 1}
                    <ContextMenu.Item
                        variant="destructive"
                        onclick={() => handleDeleteRequest(project)}
                    >
                        <Trash2 size={14} class="mr-2" />
                        {i18n._('project.delete')}
                    </ContextMenu.Item>
                {/if}
            </ContextMenu.Content>
        </ContextMenu.Root>
    {/each}

    <!-- Add project button -->
    <ButtonWithTooltip
        variant="ghost"
        class="h-8 w-8 shrink-0 rounded-none"
        label={atMax ? i18n._('project.max_reached') : i18n._('project.new')}
        disabled={atMax}
        onclick={atMax ? undefined : handleAddProject}
    >
        <Plus size={14} />
    </ButtonWithTooltip>
</div>

<!-- ── Delete confirmation dialog ──────────────────────────────────────── -->
<AlertDialog.Root open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) deleteConfirmId = null; }}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>{i18n._('project.delete_confirm_title')}</AlertDialog.Title>
            <AlertDialog.Description>
                {i18n._('project.delete_confirm_desc')}
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel onclick={() => { deleteConfirmId = null; }}>
                {i18n._('project.cancel')}
            </AlertDialog.Cancel>
            <AlertDialog.Action onclick={() => { if (deleteConfirmId) performDelete(deleteConfirmId); }}>
                {i18n._('project.delete')}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
