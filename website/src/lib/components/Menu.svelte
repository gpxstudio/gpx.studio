<script lang="ts">
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Button } from '$lib/components/ui/button';
	import Logo from './Logo.svelte';
	import {
		Plus,
		Copy,
		Download,
		Undo2,
		Redo2,
		Trash2,
		HeartHandshake,
		Upload
	} from 'lucide-svelte';
	import Fa from 'svelte-fa';
	import { faGoogleDrive } from '@fortawesome/free-brands-svg-icons';

	import {
		files,
		selectedFiles,
		duplicateSelectedFiles,
		exportAllFiles,
		exportSelectedFiles,
		removeAllFiles,
		removeSelectedFiles,
		triggerFileInput
	} from '$lib/stores';

	let distanceUnits = 'metric';
	let velocityUnits = 'speed';
	let showDistanceMarkers = false;
	let showDirectionMarkers = false;
</script>

<div class="absolute top-2 left-0 right-0 z-10 flex flex-row justify-center pointer-events-none">
	<div
		class="w-fit flex flex-row items-center p-1 bg-background rounded-md pointer-events-auto shadow-md"
	>
		<Logo class="h-5 mt-0.5 mx-2" />
		<Menubar.Root class="border-none h-fit p-0">
			<Menubar.Menu>
				<Menubar.Trigger>File</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.Item>
						<Plus size="16" class="mr-1" /> New <Menubar.Shortcut>⌘N</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item on:click={triggerFileInput}>
						<Upload size="16" class="mr-1" /> Load from desktop... <Menubar.Shortcut
							>⌘O</Menubar.Shortcut
						>
					</Menubar.Item>
					<Menubar.Item>
						<Fa icon={faGoogleDrive} class="h-4 w-4 mr-1" />
						Load from Google Drive...</Menubar.Item
					>
					<Menubar.Separator />
					<Menubar.Item on:click={duplicateSelectedFiles} disabled={$selectedFiles.size == 0}>
						<Copy size="16" class="mr-1" /> Duplicate <Menubar.Shortcut>⌘D</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={exportSelectedFiles} disabled={$selectedFiles.size == 0}>
						<Download size="16" class="mr-1" /> Export... <Menubar.Shortcut>⌘S</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item on:click={exportAllFiles} disabled={$files.length == 0}>
						<Download size="16" class="mr-1" /> Export all... <Menubar.Shortcut
							>⇧⌘S</Menubar.Shortcut
						>
					</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>Edit</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.Item>
						<Undo2 size="16" class="mr-1" /> Undo <Menubar.Shortcut>⌘Z</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item>
						<Redo2 size="16" class="mr-1" /> Redo <Menubar.Shortcut>⇧⌘Z</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Separator />
					<Menubar.Item on:click={removeSelectedFiles} disabled={$selectedFiles.size == 0}>
						<Trash2 size="16" class="mr-1" /> Delete <Menubar.Shortcut>⌘⌫</Menubar.Shortcut
						></Menubar.Item
					>
					<Menubar.Item
						class="text-destructive data-[highlighted]:text-destructive"
						on:click={removeAllFiles}
						disabled={$files.length == 0}
					>
						<Trash2 size="16" class="mr-1" /> Delete all<Menubar.Shortcut>⇧⌘⌫</Menubar.Shortcut
						></Menubar.Item
					>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>Help</Menubar.Trigger>
				<Menubar.Content>
					<Menubar.Item>
						Quick help <Menubar.Shortcut>⌘H</Menubar.Shortcut>
					</Menubar.Item>
					<Menubar.Item>User guide</Menubar.Item>
				</Menubar.Content>
			</Menubar.Menu>
			<Menubar.Menu>
				<Menubar.Trigger>Settings</Menubar.Trigger>
				<Menubar.Content
					><Menubar.Sub>
						<Menubar.SubTrigger inset>Distance units</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={distanceUnits}>
								<Menubar.RadioItem value="metric">Metric</Menubar.RadioItem>
								<Menubar.RadioItem value="imperial">Imperial</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Sub>
						<Menubar.SubTrigger inset>Velocity units</Menubar.SubTrigger>
						<Menubar.SubContent>
							<Menubar.RadioGroup bind:value={velocityUnits}>
								<Menubar.RadioItem value="speed">Speed</Menubar.RadioItem>
								<Menubar.RadioItem value="pace">Pace</Menubar.RadioItem>
							</Menubar.RadioGroup>
						</Menubar.SubContent>
					</Menubar.Sub>
					<Menubar.Separator />
					<Menubar.CheckboxItem bind:checked={showDistanceMarkers}>
						Show distance markers
					</Menubar.CheckboxItem>
					<Menubar.CheckboxItem bind:checked={showDirectionMarkers}>
						Show direction markers
					</Menubar.CheckboxItem>
				</Menubar.Content>
			</Menubar.Menu>
		</Menubar.Root>
		<div class="h-fit flex flex-row items-center ml-1 gap-1">
			<Button variant="ghost" href="/about" target="_blank" class="cursor-default h-fit rounded-sm"
				>About</Button
			>
			<Button
				variant="ghost"
				href="https://ko-fi.com/gpxstudio"
				target="_blank"
				class="cursor-default h-fit rounded-sm"
				>Donate <HeartHandshake size="16" class="ml-1" /></Button
			>
		</div>
	</div>
</div>

<svelte:window
	on:keydown={(e) => {
		e.stopImmediatePropagation();
		if (e.key === 'o' && (e.metaKey || e.ctrlKey)) {
			triggerFileInput();
			e.preventDefault();
		} else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
			duplicateSelectedFiles();
			e.preventDefault();
		} else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				exportAllFiles();
			} else {
				exportSelectedFiles();
			}
			e.preventDefault();
		} else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) {
			if (e.shiftKey) {
				console.log('removeAllFiles');
				removeAllFiles();
			} else {
				removeSelectedFiles();
			}
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
