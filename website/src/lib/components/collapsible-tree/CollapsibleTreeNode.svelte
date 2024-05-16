<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	export let id: string;

	let open = getContext<Writable<Record<string, boolean>>>('collapsible-tree-state');
	let side = getContext<'left' | 'right'>('collapsible-tree-side');

	open.update((value) => {
		if (!value.hasOwnProperty(id)) {
			value[id] = true;
		}
		return value;
	});
</script>

<Collapsible.Root bind:open={$open[id]}>
	<Collapsible.Trigger class="w-full">
		<Button
			variant="ghost"
			class="w-full flex flex-row {side === 'right'
				? 'justify-between'
				: 'justify-start'} py-0 px-1 h-fit hover:bg-background"
		>
			{#if side === 'right'}
				<slot name="trigger" />
			{/if}
			{#if $open[id]}
				<ChevronUp size="16" />
			{:else}
				<ChevronDown size="16" />
			{/if}
			{#if side === 'left'}
				<slot name="trigger" />
			{/if}
		</Button>
	</Collapsible.Trigger>
	<Collapsible.Content class="ml-1">
		<slot name="content" />
	</Collapsible.Content>
</Collapsible.Root>
