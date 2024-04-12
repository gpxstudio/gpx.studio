<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';

	import Fa from 'svelte-fa';
	import { faChevronDown, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

	import { type LayerTreeType } from '$lib/assets/layers';

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

	let open: { [key: string]: boolean } = {};
	if (!Array.isArray(node)) {
		Object.keys(node).forEach((id) => {
			open[id] = true;
		});
	}
</script>

<div class="flex flex-col gap-1">
	{#if Array.isArray(node)}
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
	{:else}
		{#each Object.keys(node) as id}
			<Collapsible.Root bind:open={open[id]} class="ml-1">
				<Collapsible.Trigger class="w-full"
					><Button
						variant="ghost"
						class="w-full flex flex-row justify-between py-0 px-1 h-fit hover:bg-background"
					>
						<span class="mr-2">{id}</span>
						{#if open[id]}
							<Fa icon={faChevronDown} size="xs" />
						{:else}
							<Fa icon={faChevronLeft} size="xs" />
						{/if}
					</Button></Collapsible.Trigger
				>
				<Collapsible.Content class="mt-1 ml-1">
					<svelte:self node={node[id]} {name} {multiple} {onValueChange} />
				</Collapsible.Content>
			</Collapsible.Root>
		{/each}
	{/if}
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
