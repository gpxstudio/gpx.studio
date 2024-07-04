<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Popover from '$lib/components/ui/popover';
	import { dbUtils } from '$lib/db';
	import { Save } from 'lucide-svelte';
	import { ListFileItem, ListTrackItem, type ListItem } from './FileList';
	import { GPXTreeElement, Track, type AnyGPXTreeElement, Waypoint, GPXFile } from 'gpx';
	import { _ } from 'svelte-i18n';
	import { editMetadata } from '$lib/stores';

	export let node: GPXTreeElement<AnyGPXTreeElement> | Waypoint[] | Waypoint;
	export let item: ListItem;
	export let open = false;

	let name: string =
		node instanceof GPXFile
			? node.metadata.name ?? ''
			: node instanceof Track
				? node.name ?? ''
				: '';
	let description: string =
		node instanceof GPXFile
			? node.metadata.desc ?? ''
			: node instanceof Track
				? node.desc ?? ''
				: '';

	$: if (!open) {
		$editMetadata = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger />
	<Popover.Content side="top" sideOffset={22} alignOffset={30} class="flex flex-col gap-3">
		<Label for="name">{$_('menu.metadata.name')}</Label>
		<Input bind:value={name} id="name" class="font-semibold h-8" />
		<Label for="description">{$_('menu.metadata.description')}</Label>
		<Textarea bind:value={description} id="description" />
		<Button
			variant="outline"
			on:click={() => {
				dbUtils.applyToFile(item.getFileId(), (file) => {
					if (item instanceof ListFileItem && node instanceof GPXFile) {
						file.metadata.name = name;
						file.metadata.desc = description;
					} else if (item instanceof ListTrackItem && node instanceof Track) {
						file.trk[item.getTrackIndex()].name = name;
						file.trk[item.getTrackIndex()].desc = description;
					}
				});
				open = false;
			}}
		>
			<Save size="16" class="mr-1" />
			{$_('menu.metadata.save')}
		</Button>
	</Popover.Content>
</Popover.Root>
