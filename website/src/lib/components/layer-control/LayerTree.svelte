<script lang="ts">
	import LayerTreeNode from './LayerTreeNode.svelte';
	import { type CollapsedInfoTreeType, type LayerTreeType } from '$lib/assets/layers';

	export let layerTree: LayerTreeType;
	export let name: string;
	export let multiple: boolean = false;

	export let onValueChange: (id: string, checked: boolean) => void;

	let open: CollapsedInfoTreeType = {
		self: true,
		children: {}
	};
</script>

<fieldset class="min-w-64">
	<LayerTreeNode {name} node={layerTree} {multiple} {onValueChange} bind:open />
</fieldset>
