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

<div class="flex flex-col">
	{#if Array.isArray(node)}
		{#each node as id}
			<div>
				{#if multiple}
					<Checkbox
						{id}
						{name}
						value={id}
						bind:checked={checked[id]}
						on:click={() => {
							onValueChange(id, !checked[id]);
						}}
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
			<div class="ml-2">
				<Label>{id}</Label>
				<svelte:self node={node[id]} {name} {multiple} {onValueChange} />
			</div>
		{/each}
	{/if}
</div>
