<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { PencilLine } from 'lucide-svelte';
    import { _ } from 'svelte-i18n';
    import { dbUtils } from '$lib/db';
    import type { PopupItem } from '$lib/components/MapPopup';
    import { ScrollArea } from '$lib/components/ui/scroll-area';

    interface OverpassTags {
        name?: string;
        image?: string;
        'image:0'?: string;
        website?: string;
        'contact:website'?: string;
        'contact:facebook'?: string;
        'contact:instagram'?: string;
        'contact:twitter'?: string;
        phone?: string;
        'contact:phone'?: string;
        [key: string]: unknown; // Allow other string keys
    }

    interface OverpassPoiItem {
        tags: string; // JSON string
        name?: string; // Used as fallback name
        query?: string; // Used as fallback name key
        lat?: number; // Added
        lon?: number; // Added
        type?: string; // Added (osm type: node/way/relation?)
        id?: number | string; // Added (osm id)
        osmType?: string; // Added (used in href)
        sym?: string; // Added (used in edit save)
        [key: string]: unknown; // Allow other properties
    }

    export let poi: PopupItem<unknown>;

    // Assert the type of poi.item
    const item = poi.item as OverpassPoiItem;

    let tags: OverpassTags = {};
    let name: string = '';
    try {
        // Use item.tags
        tags = JSON.parse(item.tags || '{}') as OverpassTags;
    } catch (e) {
        console.error('Failed to parse Overpass tags:', item.tags, e);
        tags = {}; // Assign empty object on error
    }

    $: if (tags.name !== undefined && tags.name !== '') {
        name = tags.name;
    } else {
        // Use item.name or item.query
        name = item.name ?? $_(`layers.label.${item.query ?? 'poi'}`);
    }

    // Convert tags object to array for easier iteration in template
    $: tagEntries = Object.entries(tags);
</script>

<Card.Root class="border-none shadow-md text-base p-2 max-w-[50dvw]">
    <Card.Header class="p-0">
        <Card.Title class="text-md">
            <div class="flex flex-row gap-3">
                <div class="flex flex-col">
                    {name}
                    {#if item.lat !== undefined && item.lon !== undefined}
                        <div class="text-muted-foreground text-sm font-normal">
                            {item.lat.toFixed(6)}&deg; {item.lon.toFixed(6)}&deg;
                        </div>
                    {/if}
                </div>
                <Button
                    class="ml-auto p-1.5 h-8"
                    variant="outline"
                    href="https://www.openstreetmap.org/edit?editor=id&{item.type ??
                        'node'}={item.id}"
                    target="_blank"
                >
                    <PencilLine size="16" />
                </Button>
            </div>
        </Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col p-0 text-sm mt-1 whitespace-normal break-all">
        <ScrollArea class="flex flex-col" viewportClasses="max-h-[30dvh]">
            {#if tags.image || tags['image:0']}
                <div class="w-full rounded-md overflow-clip my-2 max-w-96 mx-auto">
                    <!-- svelte-ignore a11y-missing-attribute -->
                    <img src={tags.image ?? tags['image:0']} />
                </div>
            {/if}
            {#each tagEntries as [key, value]}
                {#if value !== undefined && value !== '' && typeof value === 'string'}
                    <!-- Check value is string and not empty -->
                    <div class="text-sm">
                        <span class="font-semibold">{key}:</span>
                        {#if key === 'website' || key.startsWith('website:') || key === 'contact:website' || key === 'contact:facebook' || key === 'contact:instagram' || key === 'contact:twitter'}
                            <a href={value} target="_blank" class="text-link underline">{value}</a>
                        {:else if key === 'phone' || key === 'contact:phone'}
                            <a href={`tel:${value}`} class="text-link underline">{value}</a>
                        {:else}
                            {value}
                        {/if}
                    </div>
                {/if}
            {/each}
        </ScrollArea>
        {#if item.id}
            <Button
                variant="link"
                class="p-0 h-fit text-xs mt-1 float-right"
                on:click={() => {
                    if (item.lat !== undefined && item.lon !== undefined) {
                        // Ensure desc defaults to string using String()
                        let desc = String(tags.description ?? tags.note ?? '');
                        dbUtils.addOrUpdateWaypoint({
                            attributes: {
                                lat: item.lat, // Now safe within the check
                                lon: item.lon, // Now safe within the check
                            },
                            name: name,
                            desc: desc,
                            cmt: desc,
                            sym: item.sym,
                        });
                    }
                }}
            >
                {$_('dialog.add_waypoint')}
            </Button>
        {/if}
    </Card.Content>
</Card.Root>
