<script lang="ts" module>
    enum MergeType {
        TRACES = 'traces',
        CONTENTS = 'contents',
    }
</script>

<script lang="ts">
    import Help from '$lib/components/Help.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import * as RadioGroup from '$lib/components/ui/radio-group';
    import { i18n } from '$lib/i18n.svelte';
    import { Group } from '@lucide/svelte';
    import { getURLForLanguage } from '$lib/utils';
    import Shortcut from '$lib/components/Shortcut.svelte';
    import { onDestroy } from 'svelte';
    import { engine } from '$lib/engine';

    let props: {
        class?: string;
    } = $props();

    const selection = engine.selection;
    const statistics = engine.statistics;

    // the number of segments of the selection that have trackpoints
    const request = engine.requestStatistics();
    request.set(['anchors']);
    onDestroy(() => request.release());
    let segmentCount = $derived($statistics.anchors?.segmentStarts.length ?? 0);

    // several files, tracks or segments, or a single file or track with several segments
    let canMergeTraces = $derived.by(() => {
        switch ($selection.type) {
            case 'file':
                return $selection.fileIds.length > 1 || segmentCount > 1;
            case 'track':
                return $selection.trackIds.length > 1 || segmentCount > 1;
            case 'segment':
                return $selection.segmentIds.length > 1;
            default:
                return false;
        }
    });

    // several files or tracks, that can be put together
    let canMergeContents = $derived(
        ($selection.type === 'file' && $selection.fileIds.length > 1) ||
            ($selection.type === 'track' && $selection.trackIds.length > 1)
    );

    let hasTimes = $derived(($statistics.global.totalTime ?? 0) > 0);
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
    {#if mergeType === MergeType.TRACES && hasTimes}
        <div class="flex flex-row items-center gap-1.5">
            <Checkbox id="remove-gaps" bind:checked={removeGaps} />
            <Label for="remove-gaps">{i18n._('toolbar.merge.remove_gaps')}</Label>
        </div>
    {/if}
    <Button
        variant="outline"
        class="whitespace-normal h-fit min-h-8 py-1"
        disabled={(mergeType === MergeType.TRACES && !canMergeTraces) ||
            (mergeType === MergeType.CONTENTS && !canMergeContents)}
        onclick={() => {
            engine.merge(
                mergeType === MergeType.TRACES ? 'connect' : 'group',
                mergeType === MergeType.TRACES && hasTimes && removeGaps
            );
        }}
    >
        <Group size="16" class="shrink-0" />
        {i18n._('toolbar.merge.merge_selection')}
    </Button>
    <Help link={getURLForLanguage(i18n.lang, '/help/toolbar/merge')}>
        {#if mergeType === MergeType.TRACES && canMergeTraces}
            {i18n._('toolbar.merge.help_merge_traces')}
        {:else if mergeType === MergeType.TRACES && !canMergeTraces}
            {i18n._('toolbar.merge.help_cannot_merge_traces')}
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[0]}
            <Shortcut ctrl={true} click={true} class="border" />
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[1]}
        {:else if mergeType === MergeType.CONTENTS && canMergeContents}
            {i18n._('toolbar.merge.help_merge_contents')}
        {:else if mergeType === MergeType.CONTENTS && !canMergeContents}
            {i18n._('toolbar.merge.help_cannot_merge_contents')}
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[0]}
            <Shortcut ctrl={true} click={true} class="border" />
            {i18n._('toolbar.merge.selection_tip').split('{KEYBOARD_SHORTCUT}')[1]}
        {/if}
    </Help>
</div>
