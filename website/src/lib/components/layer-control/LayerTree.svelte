<script lang="ts">
	import LayerTreeNode from './LayerTreeNode.svelte';
	import { type LayerTreeType } from '$lib/assets/layers';

	export let layerTree: LayerTreeType;
	export let name: string;
	export let multiple: boolean = false;

	export let onValueChange: (id: string, checked: boolean) => void;
</script>

<fieldset class="min-w-52">
	<LayerTreeNode {name} node={layerTree} {multiple} {onValueChange} />
</fieldset>
