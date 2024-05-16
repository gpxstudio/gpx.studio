<script lang="ts">
	import { setContext } from 'svelte';
	import { writable } from 'svelte/store';

	let open = writable<Record<string, boolean>>({});

	setContext('collapsible-tree-state', open);
</script>

<slot />
