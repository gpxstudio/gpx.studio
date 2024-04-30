<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Button } from '$lib/components/ui/button';
	import Logo from './Logo.svelte';
	import Shortcut from './Shortcut.svelte';
	import { Plus, Copy, Download, Undo2, Redo2, Trash2, Upload, Cloud, Heart } from 'lucide-svelte';

	import {
		filestore,
		selectedFiles,
		exportAllFiles,
		exportSelectedFiles,
		triggerFileInput,
		selectFiles,
		settings,
		createFile
	} from '$lib/stores';

	import { mode, resetMode, setMode } from 'mode-watcher';

	import { _ } from 'svelte-i18n';
	import { derived, get } from 'svelte/store';

	let showDistanceMarkers = false;
	let showDirectionMarkers = false;

	let currentMode = derived(mode, ($mode) => {
		if (!$mode) {
			return 'system';
		} else {
			return $mode;
		}
	});

	$: if ($settings.mode !== get(currentMode)) {
		if ($settings.mode === 'system') {
			resetMode();
		} else {
			setMode($settings.mode);
		}
	}
</script>

<div class="absolute top-2 left-0 right-0 z-20 flex flex-row justify-center pointer-events-none">
	<div
		class="w-fit flex flex-row flex-wrap mx-16 items-center justify-center p-1 bg-background rounded-md pointer-events-auto shadow-md"
	>
		<Logo class="h-5 mt-0.5 mx-2" />
		<Menubar.Root class="border-none h-fit p-0">
			<Menubar.Menu>
				<Menubar.Trigger>{$_('menu.file')}</Menubar.Trigger>
				<Menubar.Content class="border-none">
					<Menubar.Item on:click={createFile}>
						<Plus size="16" class="mr-1" />
						{$_('menu.new')}
						<Shortcut key="N" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={triggerFileInput}>
						<Upload size="16" class="mr-1" />
						{$_('menu.load_desktop')}
						<Shortcut key="O" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item>
						<Cloud size="16" class="mr-1" />
						{$_('menu.load_drive')}</Menubar.Item
					>
					<Menubar.Separator />
					<Menubar.Item
						on:click={filestore.duplicateSelectedFiles}
						disabled={$selectedFiles.size == 0}
					>
						<Copy size="16" class="mr-1" />
						{$_('menu.duplicate')}
						<Shortcut key="D" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={exportSelectedFiles} disabled={$selectedFiles.size == 0}>
						<Download size="16" class="mr-1" />
						{$_('menu.export')}
						<Shortcut key="S" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item on:click={exportAllFiles} disabled={$filestore.length == 0}>
						<Download size="16" class="mr-1" />
						{$_('menu.export_all')}
						<Shortcut key="S" ctrl={true} shift={true} />
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>{$_('menu.edit')}</Menubar.Trigger>
				<Menubar.Content class="border-none">
					<Menubar.Item>
						<Undo2 size="16" class="mr-1" />
						{$_('menu.undo')}
						<Shortcut key="Z" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item>
						<Redo2 size="16" class="mr-1" />
						{$_('menu.redo')}
						<Shortcut key="Z" ctrl={true} shift={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={() => $selectFiles.selectAllFiles()}>
						<span class="w-4 mr-1"></span>
						{$_('menu.select_all')}
						<Shortcut key="A" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item
						on:click={filestore.deleteSelectedFiles}
						disabled={$selectedFiles.size == 0}
					>
						<Trash2 size="16" class="mr-1" />
						{$_('menu.delete')}
						<Shortcut key="⌫" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item
						class="text-destructive data-[highlighted]:text-destructive"
						on:click={filestore.deleteAllFiles}
						disabled={$filestore.length == 0}
					>
						<Trash2 size="16" class="mr-1" />
						{$_('menu.delete_all')}
						<Shortcut key="⌫" ctrl={true} shift={true} />
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>{$_('menu.settings')}</Menubar.Trigger>
				<Menubar.Content class="border-none"
					><Menubar.Sub>
						<Menubar.SubTrigger inset>{$_('menu.distance_units')}</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$settings.distanceUnits}>
								<Menubar.RadioItem value="metric">{$_('menu.metric')}</Menubar.RadioItem>
								<Menubar.RadioItem value="imperial">{$_('menu.imperial')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger inset>{$_('menu.velocity_units')}</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$settings.velocityUnits}>
								<Menubar.RadioItem value="speed">{$_('quantities.speed')}</Menubar.RadioItem>
								<Menubar.RadioItem value="pace">{$_('quantities.pace')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger inset>{$_('menu.temperature_units')}</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$settings.temperatureUnits}>
								<Menubar.RadioItem value="celsius">{$_('menu.celsius')}</Menubar.RadioItem>
								<Menubar.RadioItem value="fahrenheit">{$_('menu.fahrenheit')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Separator />
					<Menubar.Sub>
						<Menubar.SubTrigger inset>{$_('menu.mode')}</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$settings.mode}>
								<Menubar.RadioItem value="light">{$_('menu.light')}</Menubar.RadioItem>
								<Menubar.RadioItem value="dark">{$_('menu.dark')}</Menubar.RadioItem>
								<Menubar.RadioItem value="system">{$_('menu.system')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Separator />
					<Menubar.CheckboxItem bind:checked={showDistanceMarkers}>
						{$_('menu.distance_markers')}
					</Menubar.CheckboxItem>
					<Menubar.CheckboxItem bind:checked={showDirectionMarkers}>
						{$_('menu.direction_markers')}
					</Menubar.CheckboxItem>
				</Menubar.Content>
			</Menubar.Menu>
		</Menubar.Root>
		<div class="h-fit flex flex-row items-center ml-1 gap-1">
			<Button variant="ghost" href="/about" target="_blank" class="cursor-default h-fit rounded-sm"
				>{$_('menu.about')}</Button
			>
			<Button
				variant="ghost"
				href="https://ko-fi.com/gpxstudio"
				target="_blank"
				class="cursor-default h-fit rounded-sm font-bold text-support hover:text-support"
				>{$_('menu.donate')} <Heart size="16" class="ml-1" fill="rgb(var(--support))" /></Button
			>
		</div>
	</div>
</div>

<svelte:window
	on:keydown={(e) => {
		e.stopImmediatePropagation();
		if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
			createFile();
			e.preventDefault();
		} else if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
			triggerFileInput();
			e.preventDefault();
		} else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
			filestore.duplicateSelectedFiles();
			e.preventDefault();
		} else if ((e.key === 's' || e.key == 'S') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				exportAllFiles();
			} else {
				exportSelectedFiles();
			}
			e.preventDefault();
		} else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				filestore.deleteAllFiles();
			} else {
				filestore.deleteSelectedFiles();
			}
			e.preventDefault();
		} else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
			$selectFiles.selectAllFiles();
			e.preventDefault();
		}
	}}
/>

<style lang="postcss">
	div :global(button) {
		@apply hover:bg-accent;
		@apply px-3;
		@apply py-0.5;
	}

	div :global(a) {
		@apply hover:bg-accent;
		@apply px-3;
		@apply py-0.5;
	}
</style>
