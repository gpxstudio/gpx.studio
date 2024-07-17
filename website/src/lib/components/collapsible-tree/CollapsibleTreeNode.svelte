<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Button } from '$lib/components/ui/button';
	import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { getContext, onMount, setContext } from 'svelte';
	import { get, type Writable } from 'svelte/store';

	export let id: string | number;

	let defaultState = getContext<'open' | 'closed'>('collapsible-tree-default-state');
	let open = getContext<Writable<Record<string, boolean>>>('collapsible-tree-state');
	let side = getContext<'left' | 'right'>('collapsible-tree-side');
	let nohover = getContext<boolean>('collapsible-tree-nohover');
	let slotInsideTrigger = getContext<boolean>('collapsible-tree-slot-inside-trigger');
	let parentId = getContext<string>('collapsible-tree-parent-id');

	let fullId = `${parentId}.${id}`;
	setContext('collapsible-tree-parent-id', fullId);

	onMount(() => {
		if (!get(open).hasOwnProperty(fullId)) {
			open.update((value) => {
				value[fullId] = defaultState === 'open';
				return value;
			});
		}
	});

	export function openNode() {
		open.update((value) => {
			value[fullId] = true;
			return value;
		});
	}
</script>

<Collapsible.Root bind:open={$open[fullId]} class={$$props.class ?? ''}>
	{#if slotInsideTrigger}
		<Collapsible.Trigger class="w-full">
			<Button
				variant="ghost"
				class="w-full flex flex-row {side === 'right'
					? 'justify-between'
					: 'justify-start'} py-0 px-1 h-fit {nohover
					? 'hover:bg-background'
					: ''} pointer-events-none"
			>
				{#if side === 'left'}
					{#if $open[fullId]}
						<ChevronDown size="16" class="shrink-0" />
					{:else}
						<ChevronRight size="16" class="shrink-0" />
					{/if}
				{/if}
				<slot name="trigger" />
				{#if side === 'right'}
					{#if $open[fullId]}
						<ChevronDown size="16" class="shrink-0" />
					{:else}
						<ChevronLeft size="16" class="shrink-0" />
					{/if}
				{/if}
			</Button>
		</Collapsible.Trigger>
	{:else}
		<Button
			variant="ghost"
			class="w-full flex flex-row {side === 'right'
				? 'justify-between'
				: 'justify-start'} py-0 px-1 h-fit {nohover ? 'hover:bg-background' : ''}"
		>
			{#if side === 'left'}
				<Collapsible.Trigger>
					{#if $open[fullId]}
						<ChevronDown size="16" class="shrink-0" />
					{:else}
						<ChevronRight size="16" class="shrink-0" />
					{/if}
				</Collapsible.Trigger>
			{/if}
			<slot name="trigger" />
			{#if side === 'right'}
				<Collapsible.Trigger>
					{#if $open[fullId]}
						<ChevronDown size="16" class="shrink-0" />
					{:else}
						<ChevronLeft size="16" class="shrink-0" />
					{/if}
				</Collapsible.Trigger>
			{/if}
		</Button>
	{/if}

	<Collapsible.Content class="ml-2">
		<slot name="content" />
	</Collapsible.Content>
</Collapsible.Root>
