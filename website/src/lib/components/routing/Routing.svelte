<script lang="ts">
	import ToolbarItemMenu from '../toolbar/ToolbarItemMenu.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';

	import { currentTool, files, getFileStore, map, selectedFiles, Tool } from '$lib/stores';
	import { brouterProfiles, privateRoads, routing, routingProfile } from './Routing';

	import { _ } from 'svelte-i18n';
	import { get, type Writable } from 'svelte/store';
	import type { GPXFile } from 'gpx';
	import { RoutingControls } from './RoutingControls';

	let routingControls: Map<Writable<GPXFile>, RoutingControls> = new Map();
	let selectedFile: Writable<GPXFile> | null = null;
	let active = false;

	$: if ($map && $files) {
		// remove controls for deleted files
		routingControls.forEach((controls, file) => {
			if (!get(files).includes(file)) {
				controls.remove();
				routingControls.delete(file);
			}
		});
	}

	$: active = $currentTool === Tool.ROUTING;

	$: if ($map && $selectedFiles) {
		// update selected file
		if ($selectedFiles.size == 0 || $selectedFiles.size > 1 || !active) {
			if (selectedFile) {
				routingControls.get(selectedFile)?.remove();
			}
			selectedFile = null;
		} else {
			let newSelectedFile = get(selectedFiles).values().next().value;
			let newSelectedFileStore = getFileStore(newSelectedFile);
			if (selectedFile !== newSelectedFileStore) {
				if (selectedFile) {
					routingControls.get(selectedFile)?.remove();
				}
				selectedFile = newSelectedFileStore;
			}
		}
	}

	$: if ($map && selectedFile) {
		if (!routingControls.has(selectedFile)) {
			routingControls.set(selectedFile, new RoutingControls(get(map), selectedFile));
		} else {
			routingControls.get(selectedFile)?.add();
		}
	}
</script>

{#if active}
	<ToolbarItemMenu>
		<Card.Root>
			<Card.Content class="p-4 flex flex-col gap-4">
				<div class="w-full flex flex-row justify-between items-center gap-2">
					<Label>{$_('toolbar.routing.activity')}</Label>
					<Select.Root bind:selected={$routingProfile}>
						<Select.Trigger class="h-8 w-40">
							<Select.Value />
						</Select.Trigger>
						<Select.Content>
							{#each Object.keys(brouterProfiles) as profile}
								<Select.Item value={profile}
									>{$_(`toolbar.routing.activities.${profile}`)}</Select.Item
								>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="w-full flex flex-row justify-between items-center gap-2">
					<Label for="routing">{$_('toolbar.routing.use_routing')}</Label>
					<Switch id="routing" class="scale-90" bind:checked={$routing} />
				</div>
				<div class="w-full flex flex-row justify-between items-center gap-2">
					<Label for="private">{$_('toolbar.routing.allow_private')}</Label>
					<Switch id="private" class="scale-90" bind:checked={$privateRoads} />
				</div>
				<Alert.Root class="max-w-64">
					<CircleHelp size="16" />
					<!-- <Alert.Title>Heads up!</Alert.Title> -->
					<Alert.Description>
						{#if $selectedFiles.size > 1}
							<div>{$_('toolbar.routing.help_multiple_files')}</div>
						{:else if $selectedFiles.size == 0}
							<div>{$_('toolbar.routing.help_no_file')}</div>
						{:else}
							<div>{$_('toolbar.routing.help')}</div>
						{/if}
					</Alert.Description>
				</Alert.Root>
			</Card.Content>
		</Card.Root>
	</ToolbarItemMenu>
{/if}
