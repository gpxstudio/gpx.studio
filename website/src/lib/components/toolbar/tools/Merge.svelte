<script lang="ts" module>
    enum MergeType {
        TRACES = 'traces',
        CONTENTS = 'contents',
    }
</script>

<script lang="ts">
    import { ListFileItem, ListTrackItem } from '$lib/components/file-list/file-list';
    import Help from '$lib/components/Help.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import * as RadioGroup from '$lib/components/ui/radio-group';
    import { i18n } from '$lib/i18n.svelte';
    import { Group } from '@lucide/svelte';
    import { getURLForLanguage } from '$lib/utils';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import { gpxStatistics } from '$lib/stores';
    import { selection } from '$lib/logic/selection';
    import { fileStateCollection } from '$lib/logic/file-state';
    import { fileActions } from '$lib/logic/file-actions';

    let props: {
        class?: string;
    } = $props();

    let canMergeTraces = $derived.by(() => {
        if (selection.value.size > 1) {
            return true;
        } else if (selection.value.size === 1) {
            let selected = selection.value.getSelected()[0];
            if (selected instanceof ListFileItem) {
                let file = fileStateCollection.getFile(selected.getFileId());
                if (file) {
                    return file.getSegments().length > 1;
                }
            } else if (selected instanceof ListTrackItem) {
                let trackIndex = selected.getTrackIndex();
                let file = fileStateCollection.getFile(selected.getFileId());
                if (file && trackIndex < file.trk.length) {
                    return file.trk[trackIndex].getSegments().length > 1;
                }
            }
            return false;
        }
    });

    let canMergeContents = $derived(
        selection.value.size > 1 &&
            selection.value
                .getSelected()
                .some((item) => item instanceof ListFileItem || item instanceof ListTrackItem)
    );

    let removeGaps = $state(false);
    let mergeType = $state(MergeType.TRACES);
</script>

<div class="flex flex-col gap-3 w-full max-w-80 {props.class ?? ''}">
    <RadioGroup.Root bind:value={mergeType}>
        <Label class="flex flex-row items-center gap-1.5 leading-5">
            <RadioGroup.Item value={MergeType.TRACES} />
            {i18n._('toolbar.merge.merge_traces')}
        </Label>
        <Label class="flex flex-row items-center gap-1.5 leading-5">
            <RadioGroup.Item value={MergeType.CONTENTS} />
            {i18n._('toolbar.merge.merge_contents')}
        </Label>
    </RadioGroup.Root>
    {#if mergeType === MergeType.TRACES && $gpxStatistics.global.time.total > 0}
        <div class="flex flex-row items-center gap-1.5">
            <Checkbox id="remove-gaps" bind:checked={removeGaps} />
            <Label for="remove-gaps">{i18n._('toolbar.merge.remove_gaps')}</Label>
        </div>
    {/if}
    <Button
        variant="outline"
        class="whitespace-normal h-fit"
        disabled={(mergeType === MergeType.TRACES && !canMergeTraces) ||
            (mergeType === MergeType.CONTENTS && !canMergeContents)}
        onclick={() => {
            fileActions.mergeSelection(
                mergeType === MergeType.TRACES,
                mergeType === MergeType.TRACES && $gpxStatistics.global.time.total > 0 && removeGaps
            );
        }}
    >
        <Group size="16" class="mr-1 shrink-0" />
        {i18n._('toolbar.merge.merge_selection')}
    </Button>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/merge')}>
        {#if mergeType === MergeType.TRACES && canMergeTraces}
            {i18n._('toolbar.merge.help_merge_traces')}
        {:else if mergeType === MergeType.TRACES && !canMergeTraces}
            {i18n._('toolbar.merge.help_cannot_merge_traces')}
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[0]}
            <Shortcut
                ctrl={true}
                click={true}
                class="inline-flex text-muted-foreground text-xs border rounded p-0.5 gap-0"
            />
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[1]}
        {:else if mergeType === MergeType.CONTENTS && canMergeContents}
            {i18n._('toolbar.merge.help_merge_contents')}
        {:else if mergeType === MergeType.CONTENTS && !canMergeContents}
            {i18n._('toolbar.merge.help_cannot_merge_contents')}
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[0]}
            <Shortcut
                ctrl={true}
                click={true}
                class="inline-flex text-muted-foreground text-xs border rounded p-0.5 gap-0"
            />
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[1]}
        {/if}
    </Help>
</div>
