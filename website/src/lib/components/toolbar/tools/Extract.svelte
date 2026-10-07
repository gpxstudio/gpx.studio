<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Ungroup } from '@lucide/svelte';
    import Help from '$lib/components/Help.svelte';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';
    import { get } from 'svelte/store';
    import { engine } from '$lib/engine';

    let props: {
        class?: string;
    } = $props();

    const selection = engine.selection;
    const files = engine.files;
    const statistics = engine.statistics;

    /** The number of segments of a file or of one of its tracks. */
    function segmentCount(fileId: string, trackId?: string) {
        const file = $files.get(fileId);
        const tracks = file ? get(file).structure.tracks : [];
        return tracks
            .filter((track) => trackId === undefined || track.id === trackId)
            .reduce((count, track) => count + track.segments.length, 0);
    }

    // files or tracks, which all have several segments
    let validSelection = $derived.by(() => {
        // what is selected can change without the selection: the files are edited
        void $statistics;
        switch ($selection.type) {
            case 'file':
                return (
                    $selection.fileIds.length > 0 &&
                    $selection.fileIds.every((fileId) => segmentCount(fileId) > 1)
                );
            case 'track': {
                const { fileId, trackIds } = $selection;
                return (
                    trackIds.length > 0 &&
                    trackIds.every((trackId) => segmentCount(fileId, trackId) > 1)
                );
            }
            default:
                return false;
        }
    });
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <Button variant="outline" disabled={!validSelection} onclick={() => engine.extract()}>
        <Ungroup size="16" />
        {i18n._('toolbar.extract.button')}
    </Button>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/extract')}>
        {#if validSelection}
            {i18n._('toolbar.extract.help')}
        {:else}
            {i18n._('toolbar.extract.help_invalid_selection')}
        {/if}
    </Help>
</div>
