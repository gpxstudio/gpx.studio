<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { getURLForLanguage } from '$lib/utils';
    import { i18n } from '$lib/i18n.svelte';
    import { guides, guideIcons } from '$lib/components/docs/docs';

    let {
        data,
    }: {
        data: {
            guideTitles: Record<string, string>;
        };
    } = $props();
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#each Object.keys(guides) as guide}
        <Button
            variant="outline"
            href={getURLForLanguage(i18n.lang, `/help/${guide}`)}
            class="min-h-36 h-full pt-6 pb-3 px-0"
        >
            <div class="flex flex-col w-full">
                <div class="h-12 text-center text-5xl">
                    {guideIcons[guide]}
                </div>
                <div class="min-h-8 text-2xl text-center my-3 w-full whitespace-normal px-6">
                    {data.guideTitles[guide]}
                </div>
                <div class="flex flex-row justify-center flex-wrap gap-x-6 px-6">
                    {#each guides[guide] as subGuide}
                        <Button
                            variant="link"
                            href={getURLForLanguage(i18n.lang, `/help/${guide}/${subGuide}`)}
                            class="min-h-8 h-fit min-w-24 px-0 py-1 text-muted-foreground text-base text-center whitespace-normal"
                        >
                            {#if typeof guideIcons[subGuide] === 'string'}
                                {guideIcons[subGuide]}
                            {:else}
                                {@const GuideIcon = guideIcons[subGuide]}
                                <GuideIcon size="16" class="mr-1 shrink-0" />
                            {/if}
                            {data.guideTitles[`${guide}/${subGuide}`]}
                        </Button>
                    {/each}
                </div>
            </div>
        </Button>
    {/each}
</div>
