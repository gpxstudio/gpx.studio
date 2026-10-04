<script lang="ts">
    import { CollapsibleTreeNode } from '$lib/components/collapsible-tree/index';
    import FileListNodeContent from './FileListNodeContent.svelte';
    import FileListNodeLabel from './FileListNodeLabel.svelte';
    import { getContext } from 'svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { settings } from '$lib/logic/settings';
    import { engine, type FileState } from '$lib/engine';
    import {
        elementId,
        hasSelectionWithin,
        isSelected,
        type FileTreeNode,
    } from '$lib/selection-helpers';

    let {
        fileState,
        node,
    }: {
        fileState: FileState;
        node: FileTreeNode;
    } = $props();

    let recursive = getContext<boolean>('recursive');

    let collapsible: CollapsibleTreeNode | undefined = $state();

    let label = $derived.by(() => {
        const { structure } = fileState;
        switch (node.type) {
            case 'file':
                return structure.name;
            case 'track': {
                const trackIndex = structure.tracks.findIndex((t) => t.id === node.trackId);
                return (
                    structure.tracks[trackIndex]?.name ?? `${i18n._('gpx.track')} ${trackIndex + 1}`
                );
            }
            case 'segment': {
                const track = structure.tracks.find((t) => t.id === node.trackId);
                const segmentIndex =
                    track?.segments.findIndex((s) => s.id === node.segmentId) ?? -1;
                return `${i18n._('gpx.segment')} ${segmentIndex + 1}`;
            }
            case 'waypoints':
                return i18n._('gpx.waypoints');
            case 'waypoint': {
                const waypointIndex = structure.waypoints.findIndex(
                    (w) => w.id === node.waypointId
                );
                return (
                    structure.waypoints[waypointIndex]?.name ??
                    `${i18n._('gpx.waypoint')} ${waypointIndex + 1}`
                );
            }
        }
    });

    // identifies the node in the tree
    let id = $derived(elementId(node));

    const { treeFileView } = settings;
    const { selection } = engine;

    $effect(() => {
        // open the node when something below it is selected
        if (
            collapsible &&
            $treeFileView &&
            hasSelectionWithin($selection, node) &&
            !isSelected($selection, node)
        ) {
            collapsible.openNode();
        }
    });
</script>

{#if node.type === 'segment' || node.type === 'waypoint'}
    <FileListNodeLabel {fileState} {node} {label} />
{:else if recursive}
    <CollapsibleTreeNode {id} bind:this={collapsible}>
        {#snippet trigger()}
            <FileListNodeLabel {fileState} {node} {label} />
        {/snippet}
        {#snippet content()}
            <div class="ml-4">
                <FileListNodeContent {fileState} {node} />
            </div>
        {/snippet}
    </CollapsibleTreeNode>
{:else}
    <FileListNodeLabel {fileState} {node} {label} />
{/if}
