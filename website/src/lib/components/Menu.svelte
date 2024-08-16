<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Button } from '$lib/components/ui/button';
	import Logo from '$lib/components/Logo.svelte';
	import Shortcut from '$lib/components/Shortcut.svelte';
	import {
		Plus,
		Copy,
		Download,
		Undo2,
		Redo2,
		Trash2,
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
		GalleryVertical,
		Languages,
		Settings,
		Info,
		File,
		View,
		FilePen,
		HeartHandshake,
		PersonStanding,
		Eye,
		EyeOff,
		ClipboardCopy,
		Scissors,
		ClipboardPaste,
		PaintBucket,
		FolderOpen,
		FileStack,
		FileX,
		BookOpenText,
		ChartArea
	} from 'lucide-svelte';

	import {
		map,
		triggerFileInput,
		createFile,
		loadFiles,
		updateSelectionFromKey,
		allHidden,
		editMetadata,
		editStyle,
		exportState,
		ExportState
	} from '$lib/stores';
	import {
		copied,
		copySelection,
		cutSelection,
		pasteSelection,
		selectAll,
		selection
	} from '$lib/components/file-list/Selection';
	import { derived } from 'svelte/store';
	import { canUndo, canRedo, dbUtils, fileObservers, settings } from '$lib/db';
	import { anySelectedLayer } from '$lib/components/layer-control/utils';
	import { defaultOverlays } from '$lib/assets/layers';
	import LayerControlSettings from '$lib/components/layer-control/LayerControlSettings.svelte';
	import { allowedPastes, ListFileItem, ListTrackItem } from '$lib/components/file-list/FileList';
	import Export from '$lib/components/Export.svelte';
	import { mode, setMode, systemPrefersMode } from 'mode-watcher';
	import { _, locale } from 'svelte-i18n';
	import { languages } from '$lib/languages';
	import { getURLForLanguage } from '$lib/utils';

	const {
		distanceUnits,
		velocityUnits,
		temperatureUnits,
		elevationProfile,
		verticalFileView,
		currentBasemap,
		previousBasemap,
		currentOverlays,
		previousOverlays,
		distanceMarkers,
		directionMarkers,
		streetViewSource,
		routing
	} = settings;

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

	$: selectedMode = $mode ?? $systemPrefersMode ?? 'light';
</script>

<div class="absolute md:top-2 left-0 right-0 z-20 flex flex-row justify-center pointer-events-none">
	<div
		class="w-fit flex flex-row items-center justify-center p-1 bg-background rounded-b-md md:rounded-md pointer-events-auto shadow-md"
	>
		<a href="./" target="_blank">
			<Logo class="h-5 mt-0.5 mx-2 md:hidden" iconOnly={true} />
			<Logo class="h-5 mt-0.5 mx-2 hidden md:block" />
		</a>
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
						<FolderOpen size="16" class="mr-1" />
						{$_('menu.open')}
						<Shortcut key="O" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={dbUtils.duplicateSelection} disabled={$selection.size == 0}>
						<Copy size="16" class="mr-1" />
						{$_('menu.duplicate')}
						<Shortcut key="D" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={dbUtils.deleteSelectedFiles} disabled={$selection.size == 0}>
						<FileX size="16" class="mr-1" />
						{$_('menu.close')}
						<Shortcut key="⌫" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item on:click={dbUtils.deleteAllFiles} disabled={$fileObservers.size == 0}>
						<FileX size="16" class="mr-1" />
						{$_('menu.close_all')}
						<Shortcut key="⌫" ctrl={true} shift={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item
						on:click={() => ($exportState = ExportState.SELECTION)}
						disabled={$selection.size == 0}
					>
						<Download size="16" class="mr-1" />
						{$_('menu.export')}
						<Shortcut key="S" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item
						on:click={() => ($exportState = ExportState.ALL)}
						disabled={$fileObservers.size == 0}
					>
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
					<Menubar.Item
						disabled={$selection.size !== 1 ||
							!$selection
								.getSelected()
								.every((item) => item instanceof ListFileItem || item instanceof ListTrackItem)}
						on:click={() => ($editMetadata = true)}
					>
						<Info size="16" class="mr-1" />
						{$_('menu.metadata.button')}
						<Shortcut key="I" ctrl={true} />
					</Menubar.Item>
					<Menubar.Item
						disabled={$selection.size === 0 ||
							!$selection
								.getSelected()
								.every((item) => item instanceof ListFileItem || item instanceof ListTrackItem)}
						on:click={() => ($editStyle = true)}
					>
						<PaintBucket size="16" class="mr-1" />
						{$_('menu.style.button')}
					</Menubar.Item>
					<Menubar.Item
						on:click={() => {
							if ($allHidden) {
								dbUtils.setHiddenToSelection(false);
							} else {
								dbUtils.setHiddenToSelection(true);
							}
						}}
						disabled={$selection.size == 0}
					>
						{#if $allHidden}
							<Eye size="16" class="mr-1" />
							{$_('menu.unhide')}
						{:else}
							<EyeOff size="16" class="mr-1" />
							{$_('menu.hide')}
						{/if}
						<Shortcut key="H" ctrl={true} />
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={selectAll} disabled={$fileObservers.size == 0}>
						<FileStack size="16" class="mr-1" />
						{$_('menu.select_all')}
						<Shortcut key="A" ctrl={true} />
					</Menubar.Item>
					{#if $verticalFileView}
						<Menubar.Separator />
						<Menubar.Item on:click={copySelection} disabled={$selection.size === 0}>
							<ClipboardCopy size="16" class="mr-1" />
							{$_('menu.copy')}
							<Shortcut key="C" ctrl={true} />
						</Menubar.Item>
						<Menubar.Item on:click={cutSelection} disabled={$selection.size === 0}>
							<Scissors size="16" class="mr-1" />
							{$_('menu.cut')}
							<Shortcut key="X" ctrl={true} />
						</Menubar.Item>
						<Menubar.Item
							disabled={$copied === undefined ||
								$copied.length === 0 ||
								($selection.size > 0 &&
									!allowedPastes[$copied[0].level].includes($selection.getSelected().pop()?.level))}
							on:click={pasteSelection}
						>
							<ClipboardPaste size="16" class="mr-1" />
							{$_('menu.paste')}
							<Shortcut key="V" ctrl={true} />
						</Menubar.Item>
					{/if}
					<Menubar.Separator />
					<Menubar.Item on:click={dbUtils.deleteSelection} disabled={$selection.size == 0}>
						<Trash2 size="16" class="mr-1" />
						{$_('menu.delete')}
						<Shortcut key="⌫" ctrl={true} />
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
						<ChartArea size="16" class="mr-1" />
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
							<Menubar.RadioGroup bind:value={$locale}>
								{#each Object.entries(languages) as [lang, label]}
									<a href={getURLForLanguage(lang, '/app')}>
										<Menubar.RadioItem value={lang}>{label}</Menubar.RadioItem>
									</a>
								{/each}
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger>
							{#if selectedMode === 'light'}
								<Sun size="16" class="mr-1" />
							{:else}
								<Moon size="16" class="mr-1" />
							{/if}
							{$_('menu.mode')}
						</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup
								bind:value={selectedMode}
								onValueChange={(value) => {
									setMode(value);
								}}
							>
								<Menubar.RadioItem value="light">{$_('menu.light')}</Menubar.RadioItem>
								<Menubar.RadioItem value="dark">{$_('menu.dark')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Separator />
					<Menubar.Sub>
						<Menubar.SubTrigger>
							<PersonStanding size="16" class="mr-1" />
							{$_('menu.street_view_source')}
						</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={$streetViewSource}>
								<Menubar.RadioItem value="mapillary">{$_('menu.mapillary')}</Menubar.RadioItem>
								<Menubar.RadioItem value="google">{$_('menu.google')}</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
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
				href="./help"
				target="_blank"
				class="cursor-default h-fit rounded-sm px-3 py-0.5"
			>
				<BookOpenText size="18" class="md:hidden" />
				<span class="hidden md:block">
					{$_('menu.help')}
				</span>
			</Button>
			<Button
				variant="ghost"
				href="https://ko-fi.com/gpxstudio"
				target="_blank"
				class="cursor-default h-fit rounded-sm font-bold text-support hover:text-support px-3 py-0.5"
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

<Export />
<LayerControlSettings bind:open={layerSettingsOpen} />

<svelte:window
	on:keydown={(e) => {
		let targetInput =
			e.target.tagName === 'INPUT' ||
			e.target.tagName === 'TEXTAREA' ||
			e.target.tagName === 'SELECT' ||
			e.target.role === 'combobox' ||
			e.target.role === 'radio' ||
			e.target.role === 'menu' ||
			e.target.role === 'menuitem' ||
			e.target.role === 'menuitemradio' ||
			e.target.role === 'menuitemcheckbox';

		if (e.key === '+' && (e.metaKey || e.ctrlKey)) {
			createFile();
			e.preventDefault();
		} else if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
			triggerFileInput();
			e.preventDefault();
		} else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
			dbUtils.duplicateSelection();
			e.preventDefault();
		} else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
			if (!targetInput) {
				copySelection();
				e.preventDefault();
			}
		} else if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
			if (!targetInput) {
				cutSelection();
				e.preventDefault();
			}
		} else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
			if (!targetInput) {
				pasteSelection();
				e.preventDefault();
			}
		} else if ((e.key === 's' || e.key == 'S') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				if ($fileObservers.size > 0) {
					$exportState = ExportState.ALL;
				}
			} else if ($selection.size > 0) {
				$exportState = ExportState.SELECTION;
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
			if (!targetInput) {
				selectAll();
				e.preventDefault();
			}
		} else if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
			if (
				$selection.size === 1 &&
				$selection
					.getSelected()
					.every((item) => item instanceof ListFileItem || item instanceof ListTrackItem)
			) {
				$editMetadata = true;
			}
			e.preventDefault();
		} else if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
			$elevationProfile = !$elevationProfile;
			e.preventDefault();
		} else if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
			$verticalFileView = !$verticalFileView;
			e.preventDefault();
		} else if (e.key === 'h' && (e.metaKey || e.ctrlKey)) {
			if ($allHidden) {
				dbUtils.setHiddenToSelection(false);
			} else {
				dbUtils.setHiddenToSelection(true);
			}
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
		} else if (e.key === 'F5') {
			$routing = !$routing;
			e.preventDefault();
		} else if (
			e.key === 'ArrowRight' ||
			e.key === 'ArrowDown' ||
			e.key === 'ArrowLeft' ||
			e.key === 'ArrowUp'
		) {
			if (!targetInput) {
				updateSelectionFromKey(e.key === 'ArrowRight' || e.key === 'ArrowDown', e.shiftKey);
				e.preventDefault();
			}
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
</style>
