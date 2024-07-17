<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let defaultState: 'open' | 'closed' = 'open';
	export let side: 'left' | 'right' = 'right';
	export let nohover: boolean = false;
	export let slotInsideTrigger: boolean = true;

	let open = writable<Record<string, boolean>>({});

	setContext('collapsible-tree-default-state', defaultState);
	setContext('collapsible-tree-state', open);
	setContext('collapsible-tree-side', side);
	setContext('collapsible-tree-nohover', nohover);
	setContext('collapsible-tree-parent-id', 'root');
	setContext('collapsible-tree-slot-inside-trigger', slotInsideTrigger);
</script>

<slot />
