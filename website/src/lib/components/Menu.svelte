<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Button } from '$lib/components/ui/button';
	import Logo from './Logo.svelte';
	import Shortcut from './Shortcut.svelte';
	import {
		Plus,
		Copy,
		Download,
		Undo2,
		Redo2,
		Trash2,
		Upload,
		Cloud,
		Heart,
		Map,
		Layers2,
		Box,
		Milestone,
		Coins,
		Ruler,
		Zap,
		Thermometer,
		Sun,
		Moon,
		Layers3,
		MountainSnow,
		GalleryVertical,
		Languages,
		Settings,
		Info,
		File,
		View,
		FilePen,
		HeartHandshake
	} from 'lucide-svelte';

	import {
		map,
		exportAllFiles,
		exportSelectedFiles,
		triggerFileInput,
		createFile,
		loadFiles,
		toggleSelectionVisibility,
		updateSelectionFromKey
	} from '$lib/stores';
	import { selectAll, selection } from '$lib/components/file-list/Selection';
	import { derived } from 'svelte/store';
	import { canUndo, canRedo, dbUtils, fileObservers, settings } from '$lib/db';
	import { anySelectedLayer } from '$lib/components/layer-control/utils';
	import { defaultOverlays } from '$lib/assets/layers';
	import LayerControlSettings from '$lib/components/layer-control/LayerControlSettings.svelte';

	import { resetMode, setMode, systemPrefersMode } from 'mode-watcher';

	import { _, locale } from 'svelte-i18n';
	import { languages } from '$lib/languages';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	const {
		distanceUnits,
		velocityUnits,
		temperatureUnits,
		elevationProfile,
		verticalFileView,
		mode,
		currentBasemap,
		previousBasemap,
		currentOverlays,
		previousOverlays,
		distanceMarkers,
		directionMarkers
	} = settings;

	$: if ($mode === 'system') {
		resetMode();
	} else {
		setMode($mode);
	}

	let undoDisabled = derived(canUndo, ($canUndo) => !$canUndo);
	let redoDisabled = derived(canRedo, ($canRedo) => !$canRedo);

	function switchBasemaps() {
		[$currentBasemap, $previousBasemap] = [$previousBasemap, $currentBasemap];
	}

	function toggleOverlays() {
		if (anySelectedLayer($currentOverlays)) {
			[$currentOverlays, $previousOverlays] = [defaultOverlays, $currentOverlays];
		} else {
			[$currentOverlays, $previousOverlays] = [$previousOverlays, defaultOverlays];
		}
	}

	function toggle3D() {
		if ($map) {
			if ($map.getPitch() === 0) {
				$map.easeTo({ pitch: 70 });
			} else {
				$map.easeTo({ pitch: 0 });
			}
		}
	}

	let layerSettingsOpen = false;
</script>

<div class="absolute md:top-2 left-0 right-0 z-20 flex flex-row justify-center pointer-events-none">
	<div
		class="w-fit flex flex-row items-center justify-center p-1 bg-background rounded-b-md md:rounded-md pointer-events-auto shadow-md"
	>
		<Logo class="h-5 mt-0.5 mx-2 md:hidden" iconOnly={true} />
		<Logo class="h-5 mt-0.5 mx-2 hidden md:block" />
		<Menubar.Root class="border-none h-fit p-0">
			<Menubar.Menu>
				<Menubar.Trigger>
					<File size="18" class="md:hidden" />
					<span class="hidden md:block">{$_('gpx.file')}</span>
				</Menubar.Trigger>
				<Menubar.Content class="border-none">
					<Menubar.Item on:click={createFile}>
						<Plus size="16" class="mr-1" />
						{$_('menu.new')}
						<Shortcut key="+" ctrl={true} />
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
					<Menubar.Item on:click={dbUtils.duplicateSelection} disabled={$selection.size == 0}>
						<Copy size="16" class="mr-1" />
						{$_('menu.duplicate')}
						<Shortcut key="D" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={exportSelectedFiles} disabled={$selection.size == 0}>
						<Download size="16" class="mr-1" />
						{$_('menu.export')}
						<Shortcut key="S" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item on:click={exportAllFiles} disabled={$fileObservers.size == 0}>
						<Download size="16" class="mr-1" />
						{$_('menu.export_all')}
						<Shortcut key="S" ctrl={true} shift={true} />
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>
					<FilePen size="18" class="md:hidden" />
					<span class="hidden md:block">{$_('menu.edit')}</span>
				</Menubar.Trigger>
				<Menubar.Content class="border-none">
					<Menubar.Item on:click={dbUtils.undo} disabled={$undoDisabled}>
						<Undo2 size="16" class="mr-1" />
						{$_('menu.undo')}
						<Shortcut key="Z" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item on:click={dbUtils.redo} disabled={$redoDisabled}>
						<Redo2 size="16" class="mr-1" />
						{$_('menu.redo')}
						<Shortcut key="Z" ctrl={true} shift={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={selectAll}>
						<span class="w-4 mr-1"></span>
						{$_('menu.select_all')}
						<Shortcut key="A" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={dbUtils.deleteSelection} disabled={$selection.size == 0}>
						<Trash2 size="16" class="mr-1" />
						{$_('menu.delete')}
						<Shortcut key="⌫" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item
						class="text-destructive data-[highlighted]:text-destructive"
						on:click={dbUtils.deleteAllFiles}
						disabled={$fileObservers.size == 0}
					>
						<Trash2 size="16" class="mr-1" />
						{$_('menu.delete_all')}
						<Shortcut key="⌫" ctrl={true} shift={true} />
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>
					<View size="18" class="md:hidden" />
					<span class="hidden md:block">{$_('menu.view')}</span>
				</Menubar.Trigger>
				<Menubar.Content class="border-none">
					<Menubar.CheckboxItem bind:checked={$elevationProfile}>
						<MountainSnow size="16" class="mr-1" />
						{$_('menu.elevation_profile')}
						<Shortcut key="P" ctrl={true} />
					</Menubar.CheckboxItem>
					<Menubar.CheckboxItem bind:checked={$verticalFileView}>
						<GalleryVertical size="16" class="mr-1" />
						{$_('menu.vertical_file_view')}
						<Shortcut key="L" ctrl={true} />
					</Menubar.CheckboxItem>
					<Menubar.Separator />
					<Menubar.Item inset on:click={switchBasemaps}>
						<Map size="16" class="mr-1" />{$_('menu.switch_basemap')}<Shortcut key="F1" />
					</Menubar.Item>
					<Menubar.Item inset on:click={toggleOverlays}>
						<Layers2 size="16" class="mr-1" />{$_('menu.toggle_overlays')}<Shortcut key="F2" />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.CheckboxItem bind:checked={$distanceMarkers}>
						<Coins size="16" class="mr-1" />{$_('menu.distance_markers')}<Shortcut key="F3" />
					</Menubar.CheckboxItem>
					<Menubar.CheckboxItem bind:checked={$directionMarkers}>
						<Milestone size="16" class="mr-1" />{$_('menu.direction_markers')}<Shortcut key="F4" />
					</Menubar.CheckboxItem>
					<Menubar.Separator />
					<Menubar.Item inset on:click={toggle3D}>
						<Box size="16" class="mr-1" />
						{$_('menu.toggle_3d')}
						<Shortcut key="{$_('menu.ctrl')}+{$_('menu.drag')}" />
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>
					<Settings size="18" class="md:hidden" />
					<span class="hidden md:block">
						{$_('menu.settings')}
					</span>
				</Menubar.Trigger>
				<Menubar.Content class="border-none"
					><Menubar.Sub>
						<Menubar.SubTrigger>
							<Ruler size="16" class="mr-1" />{$_('menu.distance_units')}
						</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$distanceUnits}>
								<Menubar.RadioItem value="metric">{$_('menu.metric')}</Menubar.RadioItem>
								<Menubar.RadioItem value="imperial">{$_('menu.imperial')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger
							><Zap size="16" class="mr-1" />{$_('menu.velocity_units')}</Menubar.SubTrigger
						>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$velocityUnits}>
								<Menubar.RadioItem value="speed">{$_('quantities.speed')}</Menubar.RadioItem>
								<Menubar.RadioItem value="pace">{$_('quantities.pace')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger>
							<Thermometer size="16" class="mr-1" />{$_('menu.temperature_units')}
						</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$temperatureUnits}>
								<Menubar.RadioItem value="celsius">{$_('menu.celsius')}</Menubar.RadioItem>
								<Menubar.RadioItem value="fahrenheit">{$_('menu.fahrenheit')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Separator />
					<Menubar.Sub>
						<Menubar.SubTrigger>
							<Languages size="16" class="mr-1" />
							{$_('menu.language')}
						</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup
								bind:value={$locale}
								onValueChange={(value) => {
									if (value) {
										goto(base + '/' + (value === 'en' ? '' : value));
									}
								}}
							>
								{#each Object.entries(languages) as [code, name]}
									<Menubar.RadioItem value={code}>{name}</Menubar.RadioItem>
								{/each}
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger>
							{#if $mode === 'system'}
								{#if $systemPrefersMode === 'light'}
									<Sun size="16" class="mr-1" />
								{:else if $systemPrefersMode === 'dark'}
									<Moon size="16" class="mr-1" />
								{:else}
									<Sun size="16" class="mr-1" />
								{/if}
							{:else if $mode === 'light'}
								<Sun size="16" class="mr-1" />
							{:else if $mode === 'dark'}
								<Moon size="16" class="mr-1" />
							{/if}
							{$_('menu.mode')}
						</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$mode}>
								<Menubar.RadioItem value="light">{$_('menu.light')}</Menubar.RadioItem>
								<Menubar.RadioItem value="dark">{$_('menu.dark')}</Menubar.RadioItem>
								<Menubar.RadioItem value="system">{$_('menu.system')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Separator />
					<Menubar.Item on:click={() => (layerSettingsOpen = true)}>
						<Layers3 size="16" class="mr-1" />
						{$_('menu.layers')}
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
		</Menubar.Root>
		<div class="h-fit flex flex-row items-center ml-1 gap-1">
			<Button
				variant="ghost"
				href="./about"
				target="_blank"
				class="cursor-default h-fit rounded-sm"
			>
				<Info size="18" class="md:hidden" />
				<span class="hidden md:block">
					{$_('menu.about')}
				</span>
			</Button>
			<Button
				variant="ghost"
				href="https://ko-fi.com/gpxstudio"
				target="_blank"
				class="cursor-default h-fit rounded-sm font-bold text-support hover:text-support"
			>
				<HeartHandshake size="18" class="md:hidden" />
				<span class="hidden md:flex flex-row items-center">
					{$_('menu.donate')}
					<Heart size="16" class="ml-1" fill="rgb(var(--support))" />
				</span>
			</Button>
		</div>
	</div>
</div>

<LayerControlSettings bind:open={layerSettingsOpen} />

<svelte:window
	on:keydown={(e) => {
		if (e.key === '+' && (e.metaKey || e.ctrlKey)) {
			createFile();
			e.preventDefault();
		} else if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
			triggerFileInput();
			e.preventDefault();
		} else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
			dbUtils.duplicateSelection();
			e.preventDefault();
		} else if ((e.key === 's' || e.key == 'S') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				exportAllFiles();
			} else {
				exportSelectedFiles();
			}
			e.preventDefault();
		} else if ((e.key === 'z' || e.key == 'Z') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				dbUtils.redo();
			} else {
				dbUtils.undo();
			}
		} else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				dbUtils.deleteAllFiles();
			} else {
				dbUtils.deleteSelection();
			}
			e.preventDefault();
		} else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
			selectAll();
			e.preventDefault();
		} else if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
			$elevationProfile = !$elevationProfile;
			e.preventDefault();
		} else if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
			$verticalFileView = !$verticalFileView;
			e.preventDefault();
		} else if (e.key === 'h' && (e.metaKey || e.ctrlKey)) {
			toggleSelectionVisibility();
			e.preventDefault();
		} else if (e.key === 'F1') {
			switchBasemaps();
			e.preventDefault();
		} else if (e.key === 'F2') {
			toggleOverlays();
			e.preventDefault();
		} else if (e.key === 'F3') {
			$distanceMarkers = !$distanceMarkers;
			e.preventDefault();
		} else if (e.key === 'F4') {
			$directionMarkers = !$directionMarkers;
			e.preventDefault();
		} else if (
			e.key === 'ArrowRight' ||
			e.key === 'ArrowDown' ||
			e.key === 'ArrowLeft' ||
			e.key === 'ArrowUp'
		) {
			updateSelectionFromKey(e.key === 'ArrowRight' || e.key === 'ArrowDown', e.shiftKey);
			e.preventDefault();
		}
	}}
	on:dragover={(e) => e.preventDefault()}
	on:drop={(e) => {
		e.preventDefault();
		if (e.dataTransfer.files.length > 0) {
			loadFiles(e.dataTransfer.files);
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
