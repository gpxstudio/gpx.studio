<script lang="ts">
	import { page } from '$app/stores';
	import { getNextGuide, getPreviousGuide } from '$lib/components/docs/docs';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { getURLForLanguage } from '$lib/utils';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	$: previousGuide = getPreviousGuide($page.params.guide);
	$: nextGuide = getNextGuide($page.params.guide);
</script>

<DocsLoader path="{$page.params.guide}.mdx" />

<div class="flex flex-row flex-wrap gap-3 pt-6">
	{#if previousGuide}
		<Button
			variant="outline"
			class="mr-auto"
			href={getURLForLanguage(undefined, `/help/${previousGuide}`)}
		>
			<ChevronLeft size="14" class="mr-1 mt-0.5" />
			<DocsLoader path="{previousGuide}.mdx" titleOnly={true} />
		</Button>
	{/if}
	{#if nextGuide}
		<Button
			variant="outline"
			class="ml-auto"
			href={getURLForLanguage(undefined, `/help/${nextGuide}`)}
		>
			<DocsLoader path="{nextGuide}.mdx" titleOnly={true} />
			<ChevronRight size="14" class="ml-1 mt-0.5" />
		</Button>
	{/if}
</div>
