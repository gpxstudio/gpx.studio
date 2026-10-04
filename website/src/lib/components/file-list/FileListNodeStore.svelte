<script lang="ts">
    import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';
    import FileListNode from '$lib/components/file-list/FileListNode.svelte';

    import { getContext } from 'svelte';
    import type { Readable } from 'svelte/store';
    import type { FileState } from '$lib/engine';

    let {
        file,
    }: {
        file: Readable<FileState>;
    } = $props();

    let recursive = getContext<boolean>('recursive');
</script>

{#if recursive}
    <CollapsibleTree side="left" defaultState="closed" slotInsideTrigger={false}>
        <FileListNode fileState={$file} node={{ type: 'file', fileId: $file.structure.id }} />
    </CollapsibleTree>
{:else}
    <FileListNode fileState={$file} node={{ type: 'file', fileId: $file.structure.id }} />
{/if}
