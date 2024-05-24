<script lang="ts">
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';
	import { selection } from '$lib/components/file-list/Selection';
	import type { Waypoint } from 'gpx';
	import { _ } from 'svelte-i18n';
	import { ListWaypointItem } from '$lib/components/file-list/FileList';
	import { fileObservers } from '$lib/db';
	import { get } from 'svelte/store';

	let waypoint: Waypoint | undefined = undefined;

	$: if ($selection) {
		waypoint = undefined;
		$selection.forEach((item) => {
			if (item instanceof ListWaypointItem) {
				if (waypoint) return;
				let fileStore = get(fileObservers).get(item.getFileId());
				if (fileStore) {
					waypoint = get(fileStore)?.file.wpt[item.getWaypointIndex()];
				}
			}
		});
	}
</script>

<div class="flex flex-col gap-3 max-w-96">
	{#if waypoint}
		<span>{waypoint.name}</span>
		<span>{waypoint.desc ?? ''}</span>
		<span>{waypoint.cmt ?? ''}</span>
	{/if}

	<Alert.Root class="max-w-64">
		<CircleHelp size="16" />
		<Alert.Description>
			<div>{$_('toolbar.waypoint.help')}</div>
		</Alert.Description>
	</Alert.Root>
</div>
