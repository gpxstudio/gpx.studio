<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';

	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	import { type CollapsedInfoTreeType, type LayerTreeType } from '$lib/assets/layers';

	export let name: string;
	export let node: LayerTreeType;
	export let multiple: boolean = false;

	export let onValueChange: (id: string, checked: boolean) => void;

	let checked: { [key: string]: boolean } = {};
	if (multiple && Array.isArray(node)) {
		node.forEach((id) => {
			checked[id] = false;
		});
	}

	export let open: CollapsedInfoTreeType;
	if (!Array.isArray(node)) {
		Object.keys(node).forEach((id) => {
			if (!open.children.hasOwnProperty(id)) {
				open.children[id] = {
					self: true,
					children: {}
				};
			}
		});
	}
</script>

{#if Array.isArray(node)}
	<div class="flex flex-col gap-1 mt-1">
		{#each node as id}
			<div class="flex flex-row items-center gap-2">
				{#if multiple}
					<Checkbox
						{id}
						{name}
						value={id}
						bind:checked={checked[id]}
						on:click={() => {
							onValueChange(id, !checked[id]);
						}}
						class="scale-90"
					/>
				{:else}
					<input
						type="radio"
						{id}
						{name}
						value={id}
						on:change={() => {
							onValueChange(id, true);
						}}
					/>
				{/if}
				<Label for={id}>{id}</Label>
			</div>
		{/each}
	</div>
{:else}
	<div class="flex flex-col gap-1">
		{#each Object.keys(node) as id}
			<Collapsible.Root bind:open={open.children[id].self} class="ml-1">
				<Collapsible.Trigger class="w-full"
					><Button
						variant="ghost"
						class="w-full flex flex-row justify-between py-0 px-1 h-fit hover:bg-background"
					>
						<span class="mr-2">{id}</span>
						{#if open.children[id].self}
							<ChevronUp size="16" />
						{:else}
							<ChevronDown size="16" />
						{/if}
					</Button></Collapsible.Trigger
				>
				<Collapsible.Content class="ml-1">
					<svelte:self
						node={node[id]}
						{name}
						{multiple}
						{onValueChange}
						bind:open={open.children[id]}
					/>
				</Collapsible.Content>
			</Collapsible.Root>
		{/each}
	</div>
{/if}

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
