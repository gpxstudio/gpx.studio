<script lang="ts">
	import LayerTreeNode from './LayerTreeNode.svelte';
	import { type LayerTreeType } from '$lib/assets/layers';

	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Button } from '$lib/components/ui/button';

	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	export let layerTree: LayerTreeType;
	export let label: string;
	export let name: string;
	export let multiple: boolean = false;

	export let onValueChange: (id: string, checked: boolean) => void;

	let open = true;
</script>

<fieldset class="min-w-64">
	<Collapsible.Root bind:open>
		<Collapsible.Trigger class="w-full"
			><Button
				variant="ghost"
				class="w-full flex flex-row justify-between py-0 px-1 h-fit hover:bg-background"
			>
				<span class="mr-2">{label}</span>
				{#if open}
					<ChevronDown size="16" />
				{:else}
					<ChevronUp size="16" />
				{/if}
			</Button></Collapsible.Trigger
		>
		<Collapsible.Content>
			<LayerTreeNode {name} node={layerTree} {multiple} {onValueChange} />
		</Collapsible.Content>
	</Collapsible.Root>
</fieldset>
