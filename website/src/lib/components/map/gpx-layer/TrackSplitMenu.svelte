<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Dialog from '$lib/components/ui/dialog';
    import TimePicker from '$lib/components/ui/time-picker/TimePicker.svelte';
    import {
        closeTrackSplitDialog,
        closeTrackSplitMenu,
        openTrackSplitDialog,
        trackSplitDialog,
        trackSplitMenu,
    } from './track-split-menu.svelte';
    import { fileStateCollection } from '$lib/logic/file-state';
    import { i18n } from '$lib/i18n.svelte';
    import { fileActions } from '$lib/logic/file-actions';
    import { currentTool, Tool } from '$lib/components/toolbar/tools';
    import { selection } from '$lib/logic/selection';
    import { get } from 'svelte/store';

    function formatDuration(value?: number) {
        if (value === undefined || value < 0) {
            return '';
        }
        const rounded = Math.round(value);
        const hours = Math.floor(rounded / 3600)
            .toString()
            .padStart(2, '0');
        const minutes = Math.floor((rounded % 3600) / 60)
            .toString()
            .padStart(2, '0');
        const seconds = (rounded % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    let file = $derived.by(() => {
        if (!$trackSplitDialog) {
            return undefined;
        }
        return fileStateCollection.getFile($trackSplitDialog.fileId);
    });
    let movingTime = $derived.by(() => {
        if (!file) {
            return undefined;
        }
        return file.getStatistics().global.time.moving;
    });
    let startTime = $derived.by(() => {
        if (!file) {
            return undefined;
        }
        return file.getStartTimestamp();
    });
    let segmentTime = $state<number | undefined>(undefined);
    let error = $derived.by(() => {
        if (!$trackSplitDialog) {
            return '';
        }
        if (!startTime || movingTime === undefined || movingTime <= 0) {
            return i18n._('toolbar.scissors.split_missing_moving_time');
        }
        if (segmentTime === undefined) {
            return '';
        }
        if (segmentTime <= 0 || segmentTime >= movingTime) {
            return i18n._('toolbar.scissors.split_invalid_duration');
        }
        return '';
    });
    let remainingTime = $derived.by(() => {
        if (movingTime === undefined || segmentTime === undefined) {
            return undefined;
        }
        return Math.max(movingTime - segmentTime, 0);
    });
    let canSubmit = $derived(
        $trackSplitDialog !== null &&
            startTime !== undefined &&
            movingTime !== undefined &&
            movingTime > 0 &&
            segmentTime !== undefined &&
            segmentTime > 0 &&
            segmentTime < movingTime
    );

    $effect(() => {
        if ($trackSplitDialog && movingTime !== undefined && movingTime > 1) {
            segmentTime = Math.max(1, Math.min(Math.round(movingTime / 2), Math.round(movingTime) - 1));
        } else {
            segmentTime = undefined;
        }
    });

    function submit() {
        if (!$trackSplitDialog || !canSubmit || segmentTime === undefined) {
            return;
        }
        fileActions.splitFileWithDuration(
            $trackSplitDialog.fileId,
            $trackSplitDialog.trackIndex,
            $trackSplitDialog.segmentIndex,
            $trackSplitDialog.coordinates,
            segmentTime
        );
        closeTrackSplitDialog();
    }
</script>

{#if $trackSplitMenu}
    <div
        class="fixed z-50 min-w-32 rounded-md border bg-background p-1 shadow-lg"
        style={`left: ${$trackSplitMenu.screenX}px; top: ${$trackSplitMenu.screenY}px;`}
    >
        <button
            type="button"
            class="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            onclick={() => {
                openTrackSplitDialog($trackSplitMenu!);
                closeTrackSplitMenu();
            }}
        >
            {i18n._('toolbar.scissors.split_context_action')}
        </button>
    </div>
{/if}

<Dialog.Root
    open={$trackSplitDialog !== null}
    onOpenChange={(open) => {
        if (!open) {
            closeTrackSplitDialog();
        }
    }}
>
    <Dialog.Trigger class="hidden" />
    <Dialog.Content class="max-w-xl">
        <Dialog.Header>
            <Dialog.Title>{i18n._('toolbar.scissors.split_context_action')}</Dialog.Title>
            <Dialog.Description>
                {i18n._('toolbar.scissors.split_dialog_description')}
            </Dialog.Description>
        </Dialog.Header>

        {#if $trackSplitDialog}
            <div class="flex flex-col gap-4">
                {#if movingTime !== undefined && movingTime > 0}
                    <div class="grid gap-3 sm:grid-cols-2">
                        <Label class="flex flex-col gap-2">
                            <span>{i18n._('toolbar.time.total_time')}</span>
                            <Input value={formatDuration(movingTime)} disabled />
                        </Label>
                        <Label class="flex flex-col gap-2">
                            <span>{i18n._('toolbar.scissors.remaining_time')}</span>
                            <Input value={formatDuration(remainingTime)} disabled />
                        </Label>
                    </div>
                    <Label class="flex flex-col gap-2">
                        <span>{i18n._('toolbar.scissors.segment_time')}</span>
                        <TimePicker bind:value={segmentTime} />
                    </Label>
                {:else}
                    <div class="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        {error}
                    </div>
                {/if}

                {#if error}
                    <p class="text-sm text-destructive">{error}</p>
                {/if}

                {#if movingTime === undefined || movingTime <= 0}
                    <div class="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onclick={() => {
                                if ($trackSplitDialog) {
                                    selection.selectFile($trackSplitDialog.fileId);
                                }
                                currentTool.set(Tool.TIME);
                                closeTrackSplitDialog();
                            }}
                        >
                            {i18n._('toolbar.time.tooltip')}
                        </Button>
                    </div>
                {/if}
            </div>
        {/if}

        <Dialog.Footer>
            <Button variant="outline" onclick={closeTrackSplitDialog}>
                {i18n._('menu.cancel')}
            </Button>
            <Button onclick={submit} disabled={!canSubmit}>
                {i18n._('toolbar.scissors.split_context_action')}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<svelte:window
    on:click={() => {
        if (get(trackSplitMenu)) {
            closeTrackSplitMenu();
        }
    }}
    on:keydown={(e) => {
        if (e.key === 'Escape') {
            closeTrackSplitMenu();
        }
    }}
/>
