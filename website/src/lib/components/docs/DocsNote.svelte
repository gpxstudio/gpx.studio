<script lang="ts">
	export let type: 'note' | 'warning' = 'note';
</script>

<div
	class="bg-secondary border-l-8 {type === 'note'
		? 'border-link'
		: 'border-destructive'} p-2 text-sm rounded-md"
>
	<slot />
</div>

<style lang="postcss">
	div :global(a) {
		@apply text-link;
		@apply hover:underline;
	}
</style>
