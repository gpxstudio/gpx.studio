<script lang="ts">
	import CustomControl from './CustomControl';
	import mapboxgl from 'mapbox-gl';

	export let map: mapboxgl.Map | null;
	export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';

	let container: HTMLDivElement | null = null;

	$: if (map && container) {
		if (position.includes('right')) container.classList.add('float-right');
		else container.classList.add('float-left');
		container.classList.remove('hidden');
		let control = new CustomControl(container);
		map.addControl(control, position);
	}
</script>

<div
	bind:this={container}
	class="{$$props.class ||
		''} clear-both translate-0 m-[10px] pointer-events-auto bg-background rounded shadow-md hidden"
>
	<slot />
</div>
