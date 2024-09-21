<script lang="ts">
	import { _ } from 'svelte-i18n';

	export let module;
</script>

<div class="markdown flex flex-col gap-3">
	<svelte:component this={module} />
</div>

<style lang="postcss">
	:global(.markdown) {
		@apply text-muted-foreground;
	}

	:global(.markdown h1) {
		@apply text-foreground;
		@apply text-3xl;
		@apply font-semibold;
		@apply mb-3 pt-6;
	}

	:global(.markdown h2) {
		@apply text-foreground;
		@apply text-2xl;
		@apply font-semibold;
		@apply pt-3;
	}

	:global(.markdown h3) {
		@apply text-foreground;
		@apply text-lg;
		@apply font-semibold;
		@apply pt-1.5;
	}

	:global(.markdown p > button, .markdown li > button) {
		@apply border;
		@apply rounded-md;
		@apply px-1;
	}

	:global(.markdown > a) {
		@apply text-link;
		@apply hover:underline;
	}

	:global(.markdown p > a) {
		@apply text-link;
		@apply hover:underline;
	}

	:global(.markdown li > a) {
		@apply text-link;
		@apply hover:underline;
	}

	:global(.markdown kbd) {
		@apply p-1;
		@apply rounded-md;
		@apply border;
	}

	:global(.markdown ul) {
		@apply list-disc;
		@apply pl-4;
	}

	:global(.markdown ol) {
		@apply list-decimal;
		@apply pl-4;
	}

	:global(.markdown li) {
		@apply mt-1;
		@apply first:mt-0;
	}

	:global(.markdown hr) {
		@apply my-5;
	}
</style>
