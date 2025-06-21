<script lang="ts">
    import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';
    import FileListNode from '$lib/components/file-list/FileListNode.svelte';

    import type { GPXFileWithStatistics } from '$lib/db';
    import { getContext } from 'svelte';
    import type { Readable } from 'svelte/store';
    import { ListFileItem } from './FileList';

    let {
        file,
    }: {
        file: Readable<GPXFileWithStatistics | undefined>;
    } = $props();

    let recursive = getContext<boolean>('recursive');
</script>

{#if $file}
    {#if recursive}
        <CollapsibleTree side="left" defaultState="closed" slotInsideTrigger={false}>
            <FileListNode node={$file.file} item={new ListFileItem($file.file._data.id)} />
        </CollapsibleTree>
    {:else}
        <FileListNode node={$file.file} item={new ListFileItem($file.file._data.id)} />
    {/if}
{/if}
