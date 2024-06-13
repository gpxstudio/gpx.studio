<script lang="ts">
	import { Input } from '$lib/components/ui/input';

	export let value: string | number;
</script>

<div>
	<Input
		type="text"
		step={1}
		bind:value
		on:input
		on:change
		class="w-[22px] {$$props.class ?? ''}"
		{...$$restProps}
	/>
</div>

<style lang="postcss">
	div :global(input) {
		@apply px-0.5;
		@apply text-right;
		@apply border-none;
		@apply focus-visible:ring-0;
		@apply focus-visible:ring-offset-0;
	}
</style>
