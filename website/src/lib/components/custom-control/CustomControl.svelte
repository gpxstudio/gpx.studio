<script lang="ts" context="module">
	import { writable } from 'svelte/store';

	let currentId = 0;

	function getId() {
		return currentId++;
	}

	let lastInitializedId = writable(-1);
</script>

<script lang="ts">
	import CustomControl from './CustomControl';

	import { map } from '$lib/stores';

	export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';

	let container: HTMLDivElement | null = null;
	let id = getId();

	$: if ($map && container && $lastInitializedId + 1 === id) {
		if (position.includes('right')) container.classList.add('float-right');
		else container.classList.add('float-left');
		container.classList.remove('hidden');
		let control = new CustomControl(container);
		$map.addControl(control, position);
		lastInitializedId.set(id);
	}
</script>

<div
	bind:this={container}
	class="{$$props.class ||
		''} clear-both translate-0 m-[10px] mb-0 pointer-events-auto bg-background rounded shadow-md hidden"
>
	<slot />
</div>
