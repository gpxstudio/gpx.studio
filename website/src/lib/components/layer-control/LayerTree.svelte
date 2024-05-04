<script lang="ts">
	import LayerTreeNode from './LayerTreeNode.svelte';
	import {
		type CheckedInfoTreeType,
		type CollapsedInfoTreeType,
		type LayerTreeType
	} from '$lib/assets/layers';

	export let layerTree: LayerTreeType;
	export let name: string;
	export let selected: string | undefined = undefined;
	export let multiple: boolean = false;

	let open: CollapsedInfoTreeType<boolean> = {
		self: true,
		children: {}
	};
	export let checked: CheckedInfoTreeType = {};
</script>

<form>
	<fieldset class="min-w-64">
		<LayerTreeNode {name} node={layerTree} bind:selected {multiple} bind:open bind:checked />
	</fieldset>
</form>
