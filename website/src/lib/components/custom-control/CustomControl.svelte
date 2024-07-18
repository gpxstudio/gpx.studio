<script lang="ts">
	import CustomControl from './CustomControl';
	import { map } from '$lib/stores';

	export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';

	let container: HTMLDivElement;
	let control: CustomControl | undefined = undefined;

	$: if ($map && container) {
		if (position.includes('right')) container.classList.add('float-right');
		else container.classList.add('float-left');
		container.classList.remove('hidden');
		if (control === undefined) {
			control = new CustomControl(container);
		}
		$map.addControl(control, position);
	}
</script>

<div
	bind:this={container}
	class="{$$props.class ||
		''} clear-both translate-0 m-[10px] mb-0 last:mb-[10px] pointer-events-auto bg-background rounded shadow-md hidden"
>
	<slot />
</div>
