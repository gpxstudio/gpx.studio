<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Dialog } from 'bits-ui';
	import {
		currentTool,
		exportAllFiles,
		exportSelectedFiles,
		ExportState,
		exportState
	} from '$lib/stores';
	import { fileObservers } from '$lib/db';
	import { Cloud, Download } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { selection } from './file-list/Selection';

	let open = false;

	$: if ($exportState !== ExportState.NONE) {
		open = true;
		$currentTool = null;
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(isOpen) => {
		if (!isOpen) {
			$exportState = ExportState.NONE;
		}
	}}
>
	<Dialog.Trigger class="hidden" />
	<Dialog.Portal>
		<Dialog.Content
			class="fixed left-[50%] top-[50%] z-50 w-fit max-w-full translate-x-[-50%] translate-y-[-50%] flex flex-col items-center gap-2 border bg-background p-3 shadow-lg rounded-md"
		>
			<div class="flex flex-col items-center gap-2 rounded border p-2">
				<div class="flex flex-row items-center gap-2 text-sm">
					<span>⚠️</span>
					<span class="text-center max-w-96">
						{$_('menu.support_message')}
					</span>
					<span>⚠️</span>
				</div>
				<Button class="bg-support w-fit" href="https://ko-fi.com/gpxstudio">
					{$_('menu.support_button')}
					<span class="ml-2">🙏</span>
				</Button>
			</div>
			<div class="flex flex-row gap-2 justify-center">
				<Button
					variant="outline"
					on:click={() => {
						if ($exportState === ExportState.SELECTION) {
							exportSelectedFiles();
						} else if ($exportState === ExportState.ALL) {
							exportAllFiles();
						}
						open = false;
						$exportState = ExportState.NONE;
					}}
				>
					<Download size="16" class="mr-1" />
					{#if $fileObservers.size === 1 || ($exportState === ExportState.SELECTION && $selection.size === 1)}
						{$_('menu.download_file')}
					{:else}
						{$_('menu.download_files')}
					{/if}
				</Button>
				<Button variant="outline">
					<Cloud size="16" class="mr-1" />
					{$_('menu.save_drive')}
				</Button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
