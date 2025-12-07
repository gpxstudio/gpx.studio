<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { ClipboardCopy } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import type { Coordinates } from 'gpx';

    let {
        coordinates,
        onCopy = () => {},
        class: className = '',
    }: {
        coordinates: Coordinates;
        onCopy?: () => void;
        class?: string;
    } = $props();
</script>

<Button
    size="sm"
    class="justify-start {className}"
    variant="outline"
    onclick={() => {
        navigator.clipboard.writeText(
            `${coordinates.lat.toFixed(6)}, ${coordinates.lon.toFixed(6)}`
        );
        onCopy();
    }}
>
    <ClipboardCopy size="16" />
    {i18n._('menu.copy_coordinates')}
</Button>
