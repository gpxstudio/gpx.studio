<script lang="ts">
	import { getContext } from 'svelte';
	import { type Writable } from 'svelte/store';

	export let id: string;
	export let label: string | undefined;

	let selected = getContext<Writable<Set<string>>>('selected');
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<span
	class="w-full text-left truncate py-1"
	on:click={(e) => {
		e.stopPropagation(); // Avoid toggling the collapsible element
	}}
	on:contextmenu={(e) => {
		if (e.ctrlKey) {
			// Add to selection instead of opening context menu
			e.preventDefault();
			e.stopPropagation();
			selected.update((value) => {
				if (value.has(id)) {
					value.delete(id);
				} else {
					value.add(id);
				}
				return value;
			});
		}
	}}
>
	{label}
</span>
