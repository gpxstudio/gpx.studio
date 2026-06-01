<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { LoaderCircle } from '@lucide/svelte';
    import type { PopupItem } from '$lib/components/map/map-popup';
    import type { WikipediaPopupArticle } from './wikipedia-layer';

    let {
        article,
    }: {
        article: PopupItem<WikipediaPopupArticle>;
    } = $props();

    let url = $derived(article.item.article_url);
</script>

<div class="block max-w-[min(22rem,75dvw)] text-card-foreground">
    <Card.Root class="border-none shadow-md gap-0 py-0 overflow-hidden rounded-md">
        {#if article.item.image_url}
            <div>
                <img
                    src={article.item.image_url}
                    alt={article.item.name}
                    class="h-32 w-full object-cover"
                    loading="lazy"
                />
                {#if article.item.image_license_name}
                    <div class="px-3 py-1 text-[0.65rem] leading-tight text-muted-foreground">
                        {#if article.item.image_license_url}
                            <a
                                href={article.item.image_license_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="underline"
                                onclick={(event) => event.stopPropagation()}
                            >
                                {article.item.image_license_name}
                            </a>
                        {:else}
                            {article.item.image_license_name}
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
        {#if url}
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                class="block cursor-pointer text-card-foreground no-underline"
            >
                <Card.Content class="flex flex-col gap-1 p-3">
                    <Card.Title class="text-sm leading-tight">{article.item.name}</Card.Title>
                    {#if article.item.description}
                        <p class="text-xs leading-snug text-muted-foreground line-clamp-3">
                            {article.item.description}
                        </p>
                    {/if}
                </Card.Content>
            </a>
        {:else}
            <Card.Content class="flex flex-col gap-1 p-3">
                <Card.Title class="text-sm leading-tight">{article.item.name}</Card.Title>
                {#if article.item.loading}
                    <div class="flex items-center justify-center py-1 text-muted-foreground">
                        <LoaderCircle size={12} class="animate-spin opacity-80" />
                    </div>
                {/if}
            </Card.Content>
        {/if}
    </Card.Root>
</div>
