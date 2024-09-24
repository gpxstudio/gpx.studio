<script lang="ts">
	import { page } from '$app/stores';
	import { getNextGuide, getPreviousGuide } from '$lib/components/docs/docs';
	import DocsContainer from '$lib/components/docs/DocsContainer.svelte';
	import { Button } from '$lib/components/ui/button';
	import { getURLForLanguage } from '$lib/utils';
	import { ChevronLeft, ChevronRight, PenLine, CornerDownRight } from 'lucide-svelte';
	import { _, locale } from 'svelte-i18n';

	export let data: {
		guideModule: any;
		guideTitles: Record<string, string>;
	};

	$: previousGuide = getPreviousGuide($page.params.guide);
	$: nextGuide = getNextGuide($page.params.guide);
</script>

<div class="markdown flex flex-col gap-3">
	<DocsContainer module={data.guideModule.default} />
</div>

<div class="flex flex-row flex-wrap gap-3 pt-6">
	{#if previousGuide}
		<Button
			variant="outline"
			class="mr-auto"
			href={getURLForLanguage($locale, `/help/${previousGuide}`)}
		>
			<ChevronLeft size="14" class="mr-1 mt-0.5" />
			{data.guideTitles[previousGuide]}
		</Button>
	{/if}
	{#if nextGuide}
		<Button
			variant="outline"
			class="ml-auto"
			href={getURLForLanguage($locale, `/help/${nextGuide}`)}
		>
			{data.guideTitles[nextGuide]}
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
			class="p-0 h-6 text-link"
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
			class="p-0 h-6 ml-auto text-link"
		>
			<PenLine size="16" class="mr-1" />
			Edit this page on GitHub
		</Button>
	{:else}
		<Button
			variant="link"
			href="https://crowdin.com/project/gpxstudio/{$locale}"
			target="_blank"
			class="p-0 h-6 ml-auto text-link"
		>
			<PenLine size="16" class="mr-1" />
			{$_('docs.translate')}
		</Button>
	{/if}
</div>
