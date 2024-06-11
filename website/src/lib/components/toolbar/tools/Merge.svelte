<script lang="ts" context="module">
	enum MergeType {
		TRACES = 'traces',
		CONTENTS = 'contents'
	}
</script>

<script lang="ts">
	import { ListFileItem, ListTrackItem } from '$lib/components/file-list/FileList';
	import Help from '$lib/components/Help.svelte';
	import { selection } from '$lib/components/file-list/Selection';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { _ } from 'svelte-i18n';
	import { dbUtils, fileObservers } from '$lib/db';
	import { get } from 'svelte/store';
	import { Group } from 'lucide-svelte';

	let canMergeTraces = false;
	let canMergeContents = false;

	$: if ($selection.size > 1) {
		canMergeTraces = true;
	} else if ($selection.size === 1) {
		let selected = $selection.getSelected()[0];
		if (selected instanceof ListFileItem) {
			let fileId = selected.getFileId();
			let fileStore = $fileObservers.get(fileId);
			if (fileStore) {
				let file = get(fileStore)?.file;
				if (file) {
					canMergeTraces = file.getSegments().length > 1;
				} else {
					canMergeTraces = false;
				}
			} else {
				canMergeTraces = false;
			}
		} else if (selected instanceof ListTrackItem) {
			let fileId = selected.getFileId();
			let trackIndex = selected.getTrackIndex();
			let fileStore = $fileObservers.get(fileId);
			if (fileStore) {
				let file = get(fileStore)?.file;
				if (file) {
					canMergeTraces = file.trk[trackIndex].getSegments().length > 1;
				} else {
					canMergeTraces = false;
				}
			} else {
				canMergeTraces = false;
			}
		} else {
			canMergeContents = false;
		}
	}

	$: canMergeContents =
		$selection.size > 1 &&
		$selection
			.getSelected()
			.some((item) => item instanceof ListFileItem || item instanceof ListTrackItem);

	let mergeType = MergeType.TRACES;
</script>

<div class="flex flex-col gap-3 max-w-96">
	<RadioGroup.Root bind:value={mergeType}>
		<div class="flex flex-row items-center gap-2">
			<RadioGroup.Item value={MergeType.TRACES} id={MergeType.TRACES} />
			<Label for={MergeType.TRACES}>{$_('toolbar.merge.merge_traces')}</Label>
		</div>
		<div class="flex flex-row items-center gap-2">
			<RadioGroup.Item value={MergeType.CONTENTS} id={MergeType.CONTENTS} />
			<Label for={MergeType.CONTENTS}>{$_('toolbar.merge.merge_contents')}</Label>
		</div>
	</RadioGroup.Root>
	<Button
		variant="outline"
		disabled={(mergeType === MergeType.TRACES && !canMergeTraces) ||
			(mergeType === MergeType.CONTENTS && !canMergeContents)}
		on:click={() => {
			dbUtils.mergeSelection(mergeType === MergeType.TRACES);
		}}
	>
		<Group size="16" class="mr-1" />
		{$_('toolbar.merge.merge_selection')}
	</Button>
	<Help>
		{#if mergeType === MergeType.TRACES && canMergeTraces}
			{$_('toolbar.merge.help_merge_traces')}
		{:else if mergeType === MergeType.TRACES && !canMergeTraces}
			{$_('toolbar.merge.help_cannot_merge_traces')}
		{:else if mergeType === MergeType.CONTENTS && canMergeContents}
			{$_('toolbar.merge.help_merge_contents')}
		{:else if mergeType === MergeType.CONTENTS && !canMergeContents}
			{$_('toolbar.merge.help_cannot_merge_contents')}
		{/if}
	</Help>
</div>
