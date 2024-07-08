<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getURLForLanguage } from '$lib/utils';
	import { locale } from 'svelte-i18n';
	import DocsLoader from '$lib/components/docs/DocsLoader.svelte';

	let guides: Record<string, string[]> = {
		'getting-started': [],
		menu: ['file', 'edit', 'view', 'settings'],
		toolbar: ['routing', 'poi', 'scissors', 'time', 'merge', 'extract', 'reduce', 'clean'],
		'map-controls': []
	};
</script>

<div class="p-12 flex flex-row gap-24">
	<div class="hidden md:flex flex-col gap-1 w-40">
		{#each Object.keys(guides) as guide}
			<Button
				variant="link"
				href={getURLForLanguage($locale, `/help/${guide}`)}
				class="h-6 p-0 w-fit text-muted-foreground hover:text-foreground hover:no-underline font-normal hover:font-semibold items-start"
			>
				<DocsLoader path={`${guide}.svx`} titleOnly={true} />
			</Button>
			{#each guides[guide] as subGuide}
				<Button
					variant="link"
					href={getURLForLanguage($locale, `/help/${guide}/${subGuide}`)}
					class="h-6 p-0 w-fit text-muted-foreground hover:text-foreground hover:no-underline font-normal hover:font-semibold items-start ml-3"
				>
					<DocsLoader path={`${guide}/${subGuide}.svx`} titleOnly={true} />
				</Button>
			{/each}
		{/each}
	</div>
	<slot />
</div>
