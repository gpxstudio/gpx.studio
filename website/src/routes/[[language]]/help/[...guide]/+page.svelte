<script lang="ts">
	import { page } from '$app/stores';
	import { getNextGuide, getPreviousGuide } from '$lib/components/docs/docs';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { getURLForLanguage } from '$lib/utils';
	import { ChevronLeft, ChevronRight, PenLine, CornerDownRight } from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';

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

<div class="flex flex-row flex-wrap justify-between items-start mt-10 gap-3">
	<div class="flex flex-col items-start">
		<p class="text-sm text-muted-foreground">{$_('docs.answer_not_found')}</p>
		<Button
			variant="link"
			href="https://www.reddit.com/r/gpxstudio/"
			target="_blank"
			class="p-0 h-6 text-blue-500"
		>
			<CornerDownRight size="16" class="mr-1" />
			{$_('docs.ask_on_reddit')}
		</Button>
	</div>
	{#if $locale === 'en'}
		<Button
			variant="link"
			href="https://github.com/gpxstudio/gpx.studio/edit/dev/website/src/lib/docs/en/{$page.params
				.guide}.mdx"
			target="_blank"
			class="p-0 h-6 ml-auto text-blue-500"
		>
			<PenLine size="16" class="mr-1" />
			{$_('docs.edit')}
		</Button>
	{:else}
		<Button
			variant="link"
			href="https://crowdin.com/project/gpxstudio/{$locale}"
			target="_blank"
			class="p-0 h-6 ml-auto text-blue-500"
		>
			<PenLine size="16" class="mr-1" />
			{$_('docs.translate')}
		</Button>
	{/if}
</div>
