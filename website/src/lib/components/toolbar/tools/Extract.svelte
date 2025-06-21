<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Ungroup } from '@lucide/svelte';
    import { selection } from '$lib/components/file-list/Selection';
    import {
        ListFileItem,
        ListTrackItem,
        ListTrackSegmentItem,
        ListWaypointItem,
        ListWaypointsItem,
    } from '$lib/components/file-list/FileList';
    import Help from '$lib/components/Help.svelte';
    import { dbUtils, getFile } from '$lib/db';
    import { i18n } from '$lib/i18n.svelte';
    import { getURLForLanguage } from '$lib/utils';

    $: validSelection =
        $selection.size > 0 &&
        $selection.getSelected().every((item) => {
            if (
                item instanceof ListWaypointsItem ||
                item instanceof ListWaypointItem ||
                item instanceof ListTrackSegmentItem
            ) {
                return false;
            }
            let file = getFile(item.getFileId());
            if (file) {
                if (item instanceof ListFileItem) {
                    return file.getSegments().length > 1;
                } else if (item instanceof ListTrackItem) {
                    if (item.getTrackIndex() < file.trk.length) {
                        return file.trk[item.getTrackIndex()].getSegments().length > 1;
                    }
                }
            }
            return false;
        });
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {$$props.class ?? ''}">
    <Button variant="outline" disabled={!validSelection} onclick={dbUtils.extractSelection}>
        <Ungroup size="16" class="mr-1" />
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
