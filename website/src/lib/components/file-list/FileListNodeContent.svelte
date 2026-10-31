<script lang="ts">
    import { getContext, onDestroy, onMount } from 'svelte';
    import FileListNodeStore from './FileListNodeStore.svelte';
    import FileListNode from './FileListNode.svelte';
    import FileListNodeContent from './FileListNodeContent.svelte';
    import { allowedMoves, dragging, SortableFileList, type ListLevel } from './sortable-file-list';
    import { engine, type FileState } from '$lib/engine';
    import type { FileTreeNode } from '$lib/engine/selection-helpers';

    let {
        fileState,
        node,
        part = 'tracks',
    }: {
        /** State of the file of the node (not needed for the root). */
        fileState?: FileState;
        /** The node whose children are listed, `null` for the list of the files. */
        node: FileTreeNode | null;
        /**
         * For a file, which of its lists this is: its routes, its tracks, or the node standing for
         * its waypoints. Each one is followed by the next ones.
         */
        part?: 'routes' | 'tracks' | 'waypoints';
    } = $props();

    let waypointRoot = part === 'waypoints';

    const { files, order } = engine;

    let container: HTMLElement;
    let sortableLevel: ListLevel =
        node === null
            ? 'file'
            : node.type === 'file'
              ? part === 'waypoints'
                  ? 'waypoints'
                  : part === 'routes'
                    ? 'route'
                    : 'track'
              : node.type === 'waypoints'
                ? 'waypoint'
                : 'segment';
    let orientation = getContext<'vertical' | 'horizontal'>('orientation');

    let canDrop = $derived($dragging !== null && allowedMoves[$dragging].includes(sortableLevel));

    let sortable: SortableFileList;

    onMount(() => {
        sortable = new SortableFileList(container, node, waypointRoot, sortableLevel, orientation);
    });

    $effect(() => {
        // the elements of the list changed
        $order;
        fileState;
        if (sortable) {
            sortable.updateElements();
        }
    });

    onDestroy(() => {
        sortable.destroy();
    });
</script>

<div
    bind:this={container}
    class="sortable {orientation} flex {orientation === 'vertical'
        ? 'flex-col'
        : 'flex-row gap-1'} {canDrop ? 'min-h-5' : ''}"
>
    {#if node === null}
        {#each $order as fileId (fileId)}
            {@const file = $files.get(fileId)}
            {#if file}
                <div data-id={fileId}>
                    <FileListNodeStore {file} />
                </div>
            {/if}
        {/each}
    {:else if fileState}
        {#if node.type === 'file'}
            {#if part === 'waypoints'}
                {#if fileState.structure.waypoints.length > 0}
                    <div data-id="waypoints">
                        <FileListNode
                            {fileState}
                            node={{ type: 'waypoints', fileId: node.fileId }}
                        />
                    </div>
                {/if}
            {:else if part === 'routes'}
                {#each fileState.structure.routes as route (route.id)}
                    <div data-id={route.id}>
                        <FileListNode
                            {fileState}
                            node={{ type: 'route', fileId: node.fileId, routeId: route.id }}
                        />
                    </div>
                {/each}
            {:else}
                {#each fileState.structure.tracks as track (track.id)}
                    <div data-id={track.id}>
                        <FileListNode
                            {fileState}
                            node={{ type: 'track', fileId: node.fileId, trackId: track.id }}
                        />
                    </div>
                {/each}
            {/if}
        {:else if node.type === 'waypoints'}
            {#each fileState.structure.waypoints as waypoint (waypoint.id)}
                <div data-id={waypoint.id} class="ml-1">
                    <FileListNode
                        {fileState}
                        node={{ type: 'waypoint', fileId: node.fileId, waypointId: waypoint.id }}
                    />
                </div>
            {/each}
        {:else if node.type === 'track'}
            {#each fileState.structure.tracks.find((t) => t.id === node.trackId)?.segments ?? [] as segment (segment.id)}
                <div data-id={segment.id} class="ml-1">
                    <FileListNode
                        {fileState}
                        node={{
                            type: 'segment',
                            fileId: node.fileId,
                            trackId: node.trackId,
                            segmentId: segment.id,
                        }}
                    />
                </div>
            {/each}
        {/if}
    {/if}
</div>

{#if fileState && node?.type === 'file' && part === 'routes'}
    <FileListNodeContent {fileState} {node} part="tracks" />
{:else if fileState && node?.type === 'file' && part === 'tracks'}
    <FileListNodeContent {fileState} {node} part="waypoints" />
{/if}

<style lang="postcss">
    @reference "../../../app.css";

    .sortable > div {
        @apply rounded-md;
        @apply h-fit;
        @apply leading-none;
    }

    .vertical :global(button) {
        @apply hover:bg-[var(--selection)];
    }

    .vertical :global(.sortable-selected) {
        @apply bg-[var(--selection)];
    }

    .horizontal :global(button) {
        @apply bg-[var(--selection)];
        @apply hover:bg-background;
    }

    .horizontal :global(.sortable-selected button) {
        @apply bg-background;
    }
</style>
