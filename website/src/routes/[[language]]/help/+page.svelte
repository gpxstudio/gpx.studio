<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { getURLForLanguage } from '$lib/utils';
	import { locale } from 'svelte-i18n';
	import { guides, guideIcons } from '$lib/components/docs/docs';

	export let data: {
		guideTitles: Record<string, string>;
	};
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
	{#each Object.keys(guides) as guide}
		<Button
			variant="outline"
			href={getURLForLanguage($locale, `/help/${guide}`)}
			class="h-full pt-6 pb-3 px-0"
		>
			<div class="flex flex-col w-full">
				<div class="text-center text-5xl">
					{guideIcons[guide]}
				</div>
				<div class="text-2xl text-center my-3 w-full whitespace-normal px-6">
					{data.guideTitles[guide]}
				</div>
				<div class="flex flex-row justify-center flex-wrap gap-x-6 px-6">
					{#each guides[guide] as subGuide}
						<Button
							variant="link"
							href={getURLForLanguage($locale, `/help/${guide}/${subGuide}`)}
							class="h-fit px-0 py-1 text-muted-foreground   text-base text-center whitespace-normal"
						>
							<svelte:component this={guideIcons[subGuide]} size="16" class="mr-1 shrink-0" />
							{data.guideTitles[`${guide}/${subGuide}`]}
						</Button>
					{/each}
				</div>
			</div>
		</Button>
	{/each}
</div>
