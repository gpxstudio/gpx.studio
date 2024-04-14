<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { slide } from 'svelte/transition';
	import { cn } from '$lib/utils.js';

	type $$Props = AccordionPrimitive.ContentProps;

	let className: $$Props['class'] = undefined;
	export let transition: $$Props['transition'] = slide;
	export let transitionConfig: $$Props['transitionConfig'] = {
		duration: 200
	};
	export { className as class };
</script>

<AccordionPrimitive.Content
	class={cn('overflow-hidden text-sm transition-all pb-4', className)}
	{transition}
	{transitionConfig}
	{...$$restProps}
>
	<slot />
</AccordionPrimitive.Content>
