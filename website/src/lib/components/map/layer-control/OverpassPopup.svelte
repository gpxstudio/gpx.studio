<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { PencilLine, MapPin } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
    import type { WaypointType } from 'gpx';
    import type { PopupItem } from '$lib/components/map/map';
    import { fileActions } from '$lib/logic/file-actions';
    import { selection } from '$lib/logic/selection';

    export let poi: PopupItem<any>;

    let tags: { [key: string]: string } = {};
    let name = '';
    $: if (poi) {
        tags = JSON.parse(poi.item.tags);
        if (tags.name !== undefined && tags.name !== '') {
            name = tags.name;
        } else {
            name = i18n._(`layers.label.${poi.item.query}`);
        }
    }

    function addToFile() {
        const desc = Object.entries(tags)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        let wpt: WaypointType = {
            attributes: {
                lat: poi.item.lat,
                lon: poi.item.lon,
            },
            name: name,
            desc: desc,
            cmt: desc,
            sym: poi.item.sym,
        };
        if (tags.website) {
            wpt.link = {
                attributes: {
                    href: tags.website,
                },
            };
        }
        fileActions.addOrUpdateWaypoint(wpt);
    }
</script>

<Card.Root class="border-none shadow-md text-base p-2 max-w-[50dvw]">
    <Card.Header class="p-0">
        <Card.Title class="text-md">
            <div class="flex flex-row gap-3">
                <div class="flex flex-col">
                    {name}
                    <div class="text-muted-foreground text-sm font-normal">
                        {poi.item.lat.toFixed(6)}&deg; {poi.item.lon.toFixed(6)}&deg;
                    </div>
                </div>
                <Button
                    class="ml-auto p-1.5 h-8"
                    variant="outline"
                    href="https://www.openstreetmap.org/edit?editor=id&{poi.item.type ??
                        'node'}={poi.item.id}"
                    target="_blank"
                >
                    <PencilLine size="16" />
                </Button>
            </div>
        </Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col p-0 text-sm mt-1 whitespace-normal break-all">
        <ScrollArea class="flex flex-col max-h-[30dvh]">
            {#if tags.image || tags['image:0']}
                <div class="w-full rounded-md overflow-clip my-2 max-w-96 mx-auto">
                    <!-- svelte-ignore a11y-missing-attribute -->
                    <img src={tags.image ?? tags['image:0']} />
                </div>
            {/if}
            <div class="grid grid-cols-[auto_auto] gap-x-3">
                {#each Object.entries(tags) as [key, value]}
                    {#if key !== 'name' && !key.includes('image')}
                        <span class="font-mono">{key}</span>
                        {#if key === 'website' || key.startsWith('website:') || key === 'contact:website' || key === 'contact:facebook' || key === 'contact:instagram' || key === 'contact:twitter'}
                            <a href={value} target="_blank" class="text-link underline">{value}</a>
                        {:else if key === 'phone' || key === 'contact:phone'}
                            <a href={'tel:' + value} class="text-link underline">{value}</a>
                        {:else if key === 'email' || key === 'contact:email'}
                            <a href={'mailto:' + value} class="text-link underline">{value}</a>
                        {:else}
                            <span>{value}</span>
                        {/if}
                    {/if}
                {/each}
            </div>
        </ScrollArea>
        <Button class="mt-2" variant="outline" disabled={$selection.size === 0} onclick={addToFile}>
            <MapPin size="16" class="mr-1" />
            {i18n._('toolbar.waypoint.add')}
        </Button>
    </Card.Content>
</Card.Root>
