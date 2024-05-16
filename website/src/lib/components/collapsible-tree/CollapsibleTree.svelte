<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let side: 'left' | 'right' = 'right';

	let open = writable<Record<string, boolean>>({});

	setContext('collapsible-tree-state', open);
	setContext('collapsible-tree-side', side);
</script>

<slot />
