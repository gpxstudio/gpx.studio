<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import CollapsibleTreeNode from '../collapsible-tree/CollapsibleTreeNode.svelte';

	import { type LayerTreeType } from '$lib/assets/layers';
	import { anySelectedLayer } from './utils';

	import { _ } from 'svelte-i18n';
	import { settings } from '$lib/db';
	import { beforeUpdate } from 'svelte';

	export let name: string;
	export let node: LayerTreeType;
	export let selected: string | undefined = undefined;
	export let multiple: boolean = false;

	export let checked: LayerTreeType;

	const { customLayers } = settings;

	beforeUpdate(() => {
		if (checked !== undefined) {
			Object.keys(node).forEach((id) => {
				if (!checked.hasOwnProperty(id)) {
					if (typeof node[id] == 'boolean') {
						checked[id] = false;
					} else {
						checked[id] = {};
					}
				}
			});
		}
	});
</script>

<div class="flex flex-col gap-[3px]">
	{#each Object.keys(node) as id}
		{#if typeof node[id] == 'boolean'}
			{#if node[id]}
				<div class="flex flex-row items-center gap-2 first:mt-0.5 h-4">
					{#if multiple}
						<Checkbox
							id="{name}-{id}"
							{name}
							value={id}
							bind:checked={checked[id]}
							class="scale-90"
							aria-label={$_(`layers.label.${id}`)}
						/>
					{:else}
						<input id="{name}-{id}" type="radio" {name} value={id} bind:group={selected} />
					{/if}
					<Label for="{name}-{id}" class="flex flex-row items-center gap-1">
						{#if $customLayers.hasOwnProperty(id)}
							{$customLayers[id].name}
						{:else}
							{$_(`layers.label.${id}`)}
						{/if}
					</Label>
				</div>
			{/if}
		{:else if anySelectedLayer(node[id])}
			<CollapsibleTreeNode {id}>
				<span slot="trigger">{$_(`layers.label.${id}`)}</span>
				<div slot="content">
					<svelte:self node={node[id]} {name} bind:selected {multiple} bind:checked={checked[id]} />
				</div>
			</CollapsibleTreeNode>
		{/if}
	{/each}
</div>

<style lang="postcss">
	div :global(input[type='radio']) {
		@apply appearance-none;
		@apply w-4 h-4;
		@apply border-[1.5px] border-primary;
		@apply rounded-full;
		@apply ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
		@apply cursor-pointer;
		@apply checked:bg-primary;
		@apply checked:bg-clip-content;
		@apply checked:p-0.5;
	}
</style>
