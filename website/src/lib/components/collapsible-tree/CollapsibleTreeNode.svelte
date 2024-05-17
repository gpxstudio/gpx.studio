<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';

	export let id: string;

	let defaultState = getContext<'open' | 'closed'>('collapsible-tree-default-state');
	let open = getContext<Writable<Record<string, boolean>>>('collapsible-tree-state');
	let side = getContext<'left' | 'right'>('collapsible-tree-side');
	let margin = getContext<number>('collapsible-tree-margin');
	let nohover = getContext<boolean>('collapsible-tree-nohover');

	open.update((value) => {
		if (!value.hasOwnProperty(id)) {
			value[id] = defaultState === 'open';
		}
		return value;
	});
</script>

<Collapsible.Root bind:open={$open[id]} class={$$props.class ?? ''}>
	<Collapsible.Trigger class="w-full">
		<Button
			variant="ghost"
			class="w-full flex flex-row {side === 'right'
				? 'justify-between'
				: 'justify-start'} py-0 px-1 h-fit {nohover ? 'hover:bg-background' : ''}"
		>
			{#if side === 'left'}
				{#if $open[id]}
					<ChevronDown size="16" class="shrink-0" />
				{:else}
					<ChevronRight size="16" class="shrink-0" />
				{/if}
			{/if}
			<slot name="trigger" />
			{#if side === 'right'}
				{#if $open[id]}
					<ChevronDown size="16" class="shrink-0" />
				{:else}
					<ChevronLeft size="16" class="shrink-0" />
				{/if}
			{/if}
		</Button>
	</Collapsible.Trigger>
	<Collapsible.Content class="ml-{margin}">
		<slot name="content" />
	</Collapsible.Content>
</Collapsible.Root>
