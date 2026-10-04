<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { ClipboardCopy } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';

    let {
        coordinates,
        onCopy = () => {},
        class: className = '',
    }: {
        coordinates: { lng: number; lat: number };
        onCopy?: () => void;
        class?: string;
    } = $props();
</script>

<Button
    class="justify-start {className}"
    variant="outline"
    onclick={() => {
        navigator.clipboard.writeText(
            `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`
        );
        onCopy();
    }}
>
    <ClipboardCopy size="16" />
    {i18n._('menu.copy_coordinates')}
</Button>
