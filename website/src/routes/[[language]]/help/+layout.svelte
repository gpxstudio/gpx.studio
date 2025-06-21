<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { getURLForLanguage } from '$lib/utils';
    import { i18n } from '$lib/i18n.svelte';
    import { page } from '$app/state';
    import { guides } from '$lib/components/docs/docs';
    import type { Snippet } from 'svelte';

    let {
        data,
        children,
    }: {
        data: {
            guideTitles: Record<string, string>;
        };
        children: Snippet;
    } = $props();
</script>

<div class="grow px-12 pt-6 pb-12 flex flex-row gap-24">
    <div
        class="hidden md:flex flex-col gap-2 w-40 sticky mt-[27px] top-[108px] self-start shrink-0"
    >
        {#each Object.keys(guides) as guide}
            <Button
                variant="link"
                href={getURLForLanguage(i18n.lang, `/help/${guide}`)}
                class="min-h-5 h-fit p-0 w-fit text-muted-foreground hover:text-foreground hover:no-underline font-normal hover:font-semibold items-start whitespace-normal {page
                    .params.guide === guide
                    ? 'font-semibold text-foreground'
                    : ''}"
            >
                {data.guideTitles[guide]}
            </Button>
            {#each guides[guide] as subGuide}
                <Button
                    variant="link"
                    href={getURLForLanguage(i18n.lang, `/help/${guide}/${subGuide}`)}
                    class="min-h-5 h-fit p-0 w-fit text-muted-foreground hover:text-foreground hover:no-underline font-normal hover:font-semibold items-start whitespace-normal ml-3 {page
                        .params.guide ===
                    guide + '/' + subGuide
                        ? 'font-semibold text-foreground'
                        : ''}"
                >
                    {data.guideTitles[`${guide}/${subGuide}`]}
                </Button>
            {/each}
        {/each}
    </div>
    <div class="grow">
        {@render children()}
    </div>
</div>
