<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getURLForLanguage } from '$lib/utils';
	import { locale } from 'svelte-i18n';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';
	import { page } from '$app/stores';
	import { guides } from '$lib/components/docs/docs';
</script>

<div class="p-12 flex flex-row gap-24">
	<div
		class="{$page.params.guide
			? 'hidden md:flex'
			: 'flex'} flex-col gap-1 w-40 sticky top-[105px] self-start"
	>
		{#each Object.keys(guides) as guide}
			<Button
				variant="link"
				href={getURLForLanguage($locale, `/help/${guide}`)}
				class="h-6 p-0 w-fit text-muted-foreground hover:text-foreground hover:no-underline font-normal hover:font-semibold items-start {$page
					.params.guide === guide
					? 'font-semibold text-foreground'
					: ''}"
			>
				<DocsLoader path={`${guide}.mdx`} titleOnly={true} />
			</Button>
			{#each guides[guide] as subGuide}
				<Button
					variant="link"
					href={getURLForLanguage($locale, `/help/${guide}/${subGuide}`)}
					class="h-6 p-0 w-fit text-muted-foreground hover:text-foreground hover:no-underline font-normal hover:font-semibold items-start ml-3 {$page
						.params.guide ===
					guide + '/' + subGuide
						? 'font-semibold text-foreground'
						: ''}"
				>
					<DocsLoader path={`${guide}/${subGuide}.mdx`} titleOnly={true} />
				</Button>
			{/each}
		{/each}
	</div>
	<div class="grow">
		<slot />
	</div>
</div>
