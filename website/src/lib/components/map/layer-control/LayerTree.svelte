<script lang="ts">
    import LayerTreeNode from './LayerTreeNode.svelte';
    import { type LayerTreeType } from '$lib/assets/layers';
    import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';

    let {
        layerTree,
        name,
        selected = '',
        onselect = () => {},
        multiple = false,
        checked = $bindable({}),
    }: {
        layerTree: LayerTreeType;
        name: string;
        selected?: string;
        onselect?: (value: string) => void;
        multiple?: boolean;
        checked?: LayerTreeType;
    } = $props();
</script>

<form>
    <fieldset class="min-w-64 mb-1">
        <CollapsibleTree nohover={true}>
            <LayerTreeNode {name} node={layerTree} {selected} {onselect} {multiple} bind:checked />
        </CollapsibleTree>
    </fieldset>
</form>
