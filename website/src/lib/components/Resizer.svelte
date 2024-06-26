<script lang="ts">
	export let orientation: 'col' | 'row' = 'col';

	export let after: number;
	export let minAfter: number = 0;
	export let maxAfter: number = Number.MAX_SAFE_INTEGER;

	function handleMouseDown(event: MouseEvent) {
		const startX = event.clientX;
		const startY = event.clientY;
		const startAfter = after;

		const handleMouseMove = (event: MouseEvent) => {
			const newAfter =
				startAfter + (orientation === 'col' ? startX - event.clientX : startY - event.clientY);
			if (newAfter >= minAfter && newAfter <= maxAfter) {
				after = newAfter;
			} else if (newAfter < minAfter && after !== minAfter) {
				after = minAfter;
			} else if (newAfter > maxAfter && after !== maxAfter) {
				after = maxAfter;
			}
		};

		const handleMouseUp = () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="{orientation === 'col'
		? 'w-1 h-full cursor-col-resize'
		: 'w-full h-1 cursor-row-resize'} {orientation}"
	on:mousedown={handleMouseDown}
/>
