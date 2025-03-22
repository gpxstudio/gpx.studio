<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { ClipboardCopy } from 'lucide-svelte';
    import { _ } from 'svelte-i18n';
    import type { Coordinates } from 'gpx';

    export let coordinates: Coordinates;
    export let onCopy: () => void = () => {};
</script>

<Button
    class="w-full px-2 py-1 h-8 justify-start {$$props.class}"
    variant="outline"
    on:click={() => {
        navigator.clipboard.writeText(
            `${coordinates.lat.toFixed(6)}, ${coordinates.lon.toFixed(6)}`
        );
        onCopy();
    }}
>
    <ClipboardCopy size="16" class="mr-1" />
    {$_('menu.copy_coordinates')}
</Button>
