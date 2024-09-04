<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Separator } from '$lib/components/ui/separator';
	import { Dialog } from 'bits-ui';
	import {
		currentTool,
		exportAllFiles,
		exportSelectedFiles,
		ExportState,
		exportState,
		gpxStatistics
	} from '$lib/stores';
	import { fileObservers } from '$lib/db';
	import {
		Download,
		Zap,
		BrickWall,
		HeartPulse,
		Orbit,
		Thermometer,
		SquareActivity
	} from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import { selection } from './file-list/Selection';
	import { get } from 'svelte/store';
	import { GPXStatistics } from 'gpx';
	import { ListRootItem } from './file-list/FileList';

	let open = false;
	let exportOptions: Record<string, boolean> = {
		time: true,
		surface: true,
		hr: true,
		cad: true,
		atemp: true,
		power: true
	};
	let hide: Record<string, boolean> = {
		time: false,
		surface: false,
		hr: false,
		cad: false,
		atemp: false,
		power: false
	};

	$: if ($exportState !== ExportState.NONE) {
		open = true;
		$currentTool = null;

		let statistics = $gpxStatistics;
		if ($exportState === ExportState.ALL) {
			statistics = Array.from($fileObservers.values())
				.map((file) => get(file)?.statistics)
				.reduce((acc, cur) => {
					if (cur !== undefined) {
						acc.mergeWith(cur.getStatisticsFor(new ListRootItem()));
					}
					return acc;
				}, new GPXStatistics());
		}

		hide.time = statistics.global.time.total === 0;
		hide.hr = statistics.global.hr.count === 0;
		hide.cad = statistics.global.cad.count === 0;
		hide.atemp = statistics.global.atemp.count === 0;
		hide.power = statistics.global.power.count === 0;
	}

	$: exclude = Object.keys(exportOptions).filter((key) => !exportOptions[key]);
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
			class="fixed left-[50%] top-[50%] z-50 w-fit max-w-full translate-x-[-50%] translate-y-[-50%] flex flex-col items-center gap-3 border bg-background p-3 shadow-lg rounded-md"
		>
			<div
				class="w-full flex flex-row items-center justify-center gap-4 border rounded-md p-2 bg-accent"
			>
				<span>⚠️</span>
				<span class="max-w-96 text-sm">
					{$_('menu.support_message')}
				</span>
			</div>
			<div class="w-full flex flex-row flex-wrap gap-2">
				<Button class="bg-support grow" href="https://ko-fi.com/gpxstudio" target="_blank">
					{$_('menu.support_button')}
					<span class="ml-2">🙏</span>
				</Button>
				<Button
					variant="outline"
					class="grow"
					on:click={() => {
						if ($exportState === ExportState.SELECTION) {
							exportSelectedFiles(exclude);
						} else if ($exportState === ExportState.ALL) {
							exportAllFiles(exclude);
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
			</div>
			<div class="w-full max-w-xl flex flex-col items-center gap-2">
				<div class="w-full flex flex-row items-center gap-3">
					<div class="grow">
						<Separator />
					</div>
					<Label class="shrink-0">
						{$_('menu.export_options')}
					</Label>
					<div class="grow">
						<Separator />
					</div>
				</div>
				<div class="flex flex-row flex-wrap justify-center gap-x-6 gap-y-2">
					<div class="flex flex-row items-center gap-1.5 {hide.time ? 'hidden' : ''}">
						<Checkbox id="export-time" bind:checked={exportOptions.time} />
						<Label for="export-time" class="flex flex-row items-center gap-1">
							<Zap size="16" />
							{$_('quantities.time')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-1.5">
						<Checkbox id="export-surface" bind:checked={exportOptions.surface} />
						<Label for="export-surface" class="flex flex-row items-center gap-1">
							<BrickWall size="16" />
							{$_('quantities.surface')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-1.5 {hide.hr ? 'hidden' : ''}">
						<Checkbox id="export-heartrate" bind:checked={exportOptions.hr} />
						<Label for="export-heartrate" class="flex flex-row items-center gap-1">
							<HeartPulse size="16" />
							{$_('quantities.heartrate')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-1.5 {hide.cad ? 'hidden' : ''}">
						<Checkbox id="export-cadence" bind:checked={exportOptions.cad} />
						<Label for="export-cadence" class="flex flex-row items-center gap-1">
							<Orbit size="16" />
							{$_('quantities.cadence')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-1.5 {hide.atemp ? 'hidden' : ''}">
						<Checkbox id="export-temperature" bind:checked={exportOptions.atemp} />
						<Label for="export-temperature" class="flex flex-row items-center gap-1">
							<Thermometer size="16" />
							{$_('quantities.temperature')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-1.5 {hide.power ? 'hidden' : ''}">
						<Checkbox id="export-power" bind:checked={exportOptions.power} />
						<Label for="export-power" class="flex flex-row items-center gap-1">
							<SquareActivity size="16" />
							{$_('quantities.power')}
						</Label>
					</div>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
