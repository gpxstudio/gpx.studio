<script lang="ts">
	import { type LayerTreeType } from '$lib/assets/layers';

	export let name: string;
	export let node: LayerTreeType;
	export let multiple: boolean = false;

	export let onValueChange: (id: string, checked: boolean) => void;
</script>

<div class="flex flex-col">
	{#if Array.isArray(node)}
		{#each node as id}
			<div>
				{#if multiple}
					<input
						type="checkbox"
						{id}
						{name}
						value={id}
						on:change={(e) => {
							onValueChange(id, e.target.checked);
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
				<label for={id}>{id}</label>
			</div>
		{/each}
	{:else}
		{#each Object.keys(node) as id}
			<div class="ml-2">
				<span>{id}</span>
				<svelte:self node={node[id]} {name} {multiple} {onValueChange} />
			</div>
		{/each}
	{/if}
</div>
