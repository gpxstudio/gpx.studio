<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import WithUnits from '$lib/components/WithUnits.svelte';

	import { GPXStatistics } from 'gpx';

	import { fileCollection, selectedFiles, settings } from '$lib/stores';
	import { MoveDownRight, MoveUpRight, Ruler, Timer, Zap } from 'lucide-svelte';

	import { _ } from 'svelte-i18n';

	let gpxData: GPXStatistics = new GPXStatistics();

	$: {
		gpxData = new GPXStatistics();
		$fileCollection.files.forEach((file) => {
			if ($selectedFiles.has(file)) {
				gpxData.mergeWith(file.statistics);
			}
		});
	}
</script>

<Card.Root class="h-full overflow-hidden border-none min-w-48 pl-4">
	<Card.Content class="h-full flex flex-col flex-wrap gap-4 justify-center p-0">
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<Ruler size="18" class="mr-1" />
				<WithUnits value={gpxData.distance.total} type="distance" />
			</span>
			<span slot="tooltip">{$_('quantities.distance')}</span>
		</Tooltip>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<MoveUpRight size="18" class="mr-1" />
				<WithUnits value={gpxData.elevation.gain} type="elevation" />
				<MoveDownRight size="18" class="mx-1" />
				<WithUnits value={gpxData.elevation.loss} type="elevation" />
			</span>
			<span slot="tooltip">{$_('quantities.elevation')}</span>
		</Tooltip>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<Zap size="18" class="mr-1" />
				<WithUnits value={gpxData.speed.moving} type="speed" showUnits={false} /> /
				<WithUnits value={gpxData.speed.total} type="speed" />
			</span>
			<span slot="tooltip"
				>{$settings.velocityUnits === 'speed' ? $_('quantities.speed') : $_('quantities.pace')} ({$_(
					'quantities.moving'
				)} / {$_('quantities.total')})</span
			>
		</Tooltip>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<Timer size="18" class="mr-1" />
				<WithUnits value={gpxData.time.moving} type="time" />
				<span class="mx-1">/</span>
				<WithUnits value={gpxData.time.total} type="time" />
			</span>
			<span slot="tooltip"
				>{$_('quantities.time')} ({$_('quantities.moving')} / {$_('quantities.total')})</span
			>
		</Tooltip>
	</Card.Content>
</Card.Root>
