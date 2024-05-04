<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Button } from '$lib/components/ui/button';
	import * as Collapsible from '$lib/components/ui/collapsible';

	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	import {
		type CheckedInfoTreeType,
		type CollapsedInfoTreeType,
		type LayerTreeType
	} from '$lib/assets/layers';

	import { _ } from 'svelte-i18n';

	export let name: string;
	export let node: LayerTreeType;
	export let selected: string | undefined = undefined;
	export let multiple: boolean = false;

	export let open: CollapsedInfoTreeType<boolean>;
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

	export let checked: CheckedInfoTreeType;
	if (Array.isArray(node)) {
		if (multiple) {
			node.forEach((id) => {
				if (!checked.hasOwnProperty(id)) {
					checked[id] = false;
				}
			});
		}
	} else {
		Object.keys(node).forEach((id) => {
			if (!checked.hasOwnProperty(id)) {
				checked[id] = {};
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
						id="{name}-{id}"
						{name}
						value={id}
						bind:checked={checked[id]}
						class="scale-90"
					/>
				{:else}
					<input id="{name}-{id}" type="radio" {name} value={id} bind:group={selected} />
				{/if}
				<Label for="{name}-{id}" class="flex flex-row items-center gap-1"
					>{$_(`layers.label.${id}`)}</Label
				>
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
						<span class="mr-2">{$_(`layers.label.${id}`)}</span>
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
						bind:selected
						{multiple}
						bind:open={open.children[id]}
						bind:checked={checked[id]}
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
