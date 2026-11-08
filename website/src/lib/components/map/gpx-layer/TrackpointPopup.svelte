<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import CopyCoordinates from '$lib/components/map/gpx-layer/CopyCoordinates.svelte';
    import * as Card from '$lib/components/ui/card';
    import { Compass, Earth } from '@lucide/svelte';
    import { i18n } from '$lib/i18n/i18n.svelte';
    import type { PopupItem } from '$lib/components/map/map-popup';
    import { map } from '$lib/components/map/map';

    let {
        trackpoint,
    }: {
        trackpoint: PopupItem<{ lng: number; lat: number }>;
    } = $props();
</script>

<Card.Root class="border-none shadow-md text-base p-2">
    <Card.Content class="flex flex-col p-0 text-xs gap-1">
        <div class="flex flex-row items-center gap-1">
            <Compass size="14" />
            {trackpoint.item.lat.toFixed(6)}&deg; {trackpoint.item.lng.toFixed(6)}&deg;
        </div>
        <CopyCoordinates
            coordinates={trackpoint.item}
            onCopy={() => trackpoint.hide?.()}
            class="mt-0.5"
        />
        <Button
            variant="outline"
            class="justify-start"
            href={`https://www.openstreetmap.org/edit?#map=${(($map?.getZoom() ?? 17) + 1).toFixed(0)}/${trackpoint.item.lat.toFixed(5)}/${trackpoint.item.lng.toFixed(5)}`}
            target="_blank"
        >
            <Earth size="14" />
            {i18n._('menu.edit_osm')}
        </Button>
    </Card.Content>
</Card.Root>
