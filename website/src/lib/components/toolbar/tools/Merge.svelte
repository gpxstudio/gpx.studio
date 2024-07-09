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
	import { dbUtils, getFile } from '$lib/db';
	import { Group } from 'lucide-svelte';

	let canMergeTraces = false;
	let canMergeContents = false;

	$: if ($selection.size > 1) {
		canMergeTraces = true;
	} else if ($selection.size === 1) {
		let selected = $selection.getSelected()[0];
		if (selected instanceof ListFileItem) {
			let file = getFile(selected.getFileId());
			if (file) {
				canMergeTraces = file.getSegments().length > 1;
			} else {
				canMergeTraces = false;
			}
		} else if (selected instanceof ListTrackItem) {
			let trackIndex = selected.getTrackIndex();
			let file = getFile(selected.getFileId());
			if (file && trackIndex < file.trk.length) {
				canMergeTraces = file.trk[trackIndex].getSegments().length > 1;
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

<div class="flex flex-col gap-3 w-full max-w-80">
	<RadioGroup.Root bind:value={mergeType}>
		<Label class="flex flex-row items-center gap-2 leading-5">
			<RadioGroup.Item value={MergeType.TRACES} />
			{$_('toolbar.merge.merge_traces')}
		</Label>
		<Label class="flex flex-row items-center gap-2 leading-5">
			<RadioGroup.Item value={MergeType.CONTENTS} />
			{$_('toolbar.merge.merge_contents')}
		</Label>
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
