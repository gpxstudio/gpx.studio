<script lang="ts">
	import ToolbarItemMenu from '$lib/components/toolbar/ToolbarItemMenu.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { CircleHelp } from 'lucide-svelte';

	import { Tool, selectedFiles } from '$lib/stores';

	import { _ } from 'svelte-i18n';

	$: $selectedFiles.forEach((file) => {
		// todo
	});
</script>

<ToolbarItemMenu tool={Tool.WAYPOINT}>
	<div class="w-full flex flex-row justify-between items-center gap-2">todo</div>

	<Alert.Root class="max-w-64">
		<CircleHelp size="16" />
		<Alert.Description>
			<div>{$_('toolbar.waypoint.help')}</div>
		</Alert.Description>
	</Alert.Root>
</ToolbarItemMenu>
