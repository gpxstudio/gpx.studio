<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';

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
			<div class="ml-2 flex flex-col gap-1">
				<Label>{id}</Label>
				<svelte:self node={node[id]} {name} {multiple} {onValueChange} />
			</div>
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
