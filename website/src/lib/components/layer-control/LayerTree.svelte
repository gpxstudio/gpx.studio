<script lang="ts">
	import LayerTreeNode from './LayerTreeNode.svelte';
	import { type LayerTreeType } from '$lib/assets/layers';
	import CollapsibleTree from '$lib/components/collapsible-tree/CollapsibleTree.svelte';

	export let layerTree: LayerTreeType;
	export let name: string;
	export let selected: string | undefined = undefined;
	export let multiple: boolean = false;

	export let checked: LayerTreeType = {};
</script>

<form>
	<fieldset class="min-w-64">
		<CollapsibleTree nohover={true}>
			<LayerTreeNode {name} node={layerTree} bind:selected {multiple} bind:checked />
		</CollapsibleTree>
	</fieldset>
</form>
