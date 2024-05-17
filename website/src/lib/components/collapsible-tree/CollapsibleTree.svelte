<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let defaultState: 'open' | 'closed' = 'open';
	export let side: 'left' | 'right' = 'right';
	export let margin: number = 1;
	export let nohover: boolean = false;

	let open = writable<Record<string, boolean>>({});

	setContext('collapsible-tree-default-state', defaultState);
	setContext('collapsible-tree-state', open);
	setContext('collapsible-tree-side', side);
	setContext('collapsible-tree-margin', margin);
	setContext('collapsible-tree-nohover', nohover);
</script>

<slot />
