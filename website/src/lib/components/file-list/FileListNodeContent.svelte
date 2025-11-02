<script lang="ts">
    import { GPXFile, Track, Waypoint, type AnyGPXTreeElement, type GPXTreeElement } from 'gpx';
    import { getContext, onDestroy, onMount } from 'svelte';
    import { type Readable } from 'svelte/store';
    import FileListNodeStore from './FileListNodeStore.svelte';
    import FileListNode from './FileListNode.svelte';
    import FileListNodeContent from './FileListNodeContent.svelte';
    import { ListFileItem, ListLevel, ListWaypointsItem, type ListItem } from './file-list';
    import type { GPXFileWithStatistics } from '$lib/logic/statistics-tree';
    import { allowedMoves, dragging, SortableFileList } from './sortable-file-list';

    let {
        node,
        item,
        waypointRoot = false,
    }: {
        node:
            | Map<string, Readable<GPXFileWithStatistics | undefined>>
            | GPXTreeElement<AnyGPXTreeElement>
            | Waypoint[]
            | Waypoint;
        item: ListItem;
        waypointRoot?: boolean;
    } = $props();

    let container: HTMLElement;
    let sortableLevel: ListLevel =
        node instanceof Map
            ? ListLevel.FILE
            : node instanceof GPXFile
              ? waypointRoot
                  ? ListLevel.WAYPOINTS
                  : item instanceof ListWaypointsItem
                    ? ListLevel.WAYPOINT
                    : ListLevel.TRACK
              : node instanceof Track
                ? ListLevel.SEGMENT
                : ListLevel.WAYPOINT;
    let orientation = getContext<'vertical' | 'horizontal'>('orientation');

    let canDrop = $derived($dragging !== null && allowedMoves[$dragging].includes(sortableLevel));

    let sortable: SortableFileList;

    onMount(() => {
        sortable = new SortableFileList(
            container,
            node,
            item,
            waypointRoot,
            sortableLevel,
            orientation
        );
    });

    $effect(() => {
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
    {#if node instanceof Map}
        {#each node as [fileId, file] (fileId)}
            <div data-id={fileId}>
                <FileListNodeStore {file} />
            </div>
        {/each}
    {:else if node instanceof GPXFile}
        {#if item instanceof ListWaypointsItem}
            {#each node.wpt as wpt, i (wpt)}
                <div data-id={i} class="ml-1">
                    <FileListNode node={wpt} item={item.extend(i)} />
                </div>
            {/each}
        {:else if waypointRoot}
            {#if node.wpt.length > 0}
                <div data-id="waypoints">
                    <FileListNode {node} item={item.extend('waypoints')} />
                </div>
            {/if}
        {:else}
            {#each node.children as child, i (child)}
                <div data-id={i}>
                    <FileListNode node={child} item={item.extend(i)} />
                </div>
            {/each}
        {/if}
    {:else if node instanceof Track}
        {#each node.children as child, i (child)}
            <div data-id={i} class="ml-1">
                <FileListNode node={child} item={item.extend(i)} />
            </div>
        {/each}
    {/if}
</div>

{#if node instanceof GPXFile && item instanceof ListFileItem}
    {#if !waypointRoot}
        <FileListNodeContent {node} {item} waypointRoot={true} />
    {/if}
{/if}

<style lang="postcss">
    @reference "../../../app.css";

    .sortable > div {
        @apply rounded-md;
        @apply h-fit;
        @apply leading-none;
    }

    .vertical :global(button) {
        @apply hover:bg-muted;
    }

    .vertical :global(.sortable-selected button) {
        @apply hover:bg-accent;
    }

    .vertical :global(.sortable-selected) {
        @apply bg-accent;
    }

    .horizontal :global(button) {
        @apply bg-accent;
        @apply hover:bg-muted;
    }

    .horizontal :global(.sortable-selected button) {
        @apply bg-background;
    }
</style>
