<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import WithUnits from '$lib/components/WithUnits.svelte';

	import { gpxStatistics, slicedGPXStatistics, currentTool, Tool } from '$lib/stores';
	import { settings } from '$lib/db';

	import { MoveDownRight, MoveUpRight, Ruler, Timer, Zap } from 'lucide-svelte';

	import { _ } from 'svelte-i18n';
	import type { GPXStatistics } from 'gpx';

	const { velocityUnits, elevationProfile } = settings;

	let statistics: GPXStatistics;

	$: if ($slicedGPXStatistics !== undefined) {
		statistics = $slicedGPXStatistics[0];
	} else {
		statistics = $gpxStatistics;
	}
</script>

<Card.Root
	class="h-full {$elevationProfile
		? ''
		: 'w-full pr-4'} overflow-hidden border-none shadow-none min-w-48 pl-4"
>
	<Card.Content
		class="h-full flex {$elevationProfile
			? 'flex-col justify-center'
			: 'flex-row w-full justify-between'} flex-wrap gap-4  p-0"
	>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<Ruler size="18" class="mr-1" />
				<WithUnits value={statistics.global.distance.total} type="distance" />
			</span>
			<span slot="tooltip">{$_('quantities.distance')}</span>
		</Tooltip>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<MoveUpRight size="18" class="mr-1" />
				<WithUnits value={statistics.global.elevation.gain} type="elevation" />
				<MoveDownRight size="18" class="mx-1" />
				<WithUnits value={statistics.global.elevation.loss} type="elevation" />
			</span>
			<span slot="tooltip">{$_('quantities.elevation')}</span>
		</Tooltip>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<Zap size="18" class="mr-1" />
				<WithUnits value={statistics.global.speed.total} type="speed" showUnits={false} />
				<span class="mx-1">/</span>
				<WithUnits value={statistics.global.speed.moving} type="speed" />
			</span>
			<span slot="tooltip"
				>{$velocityUnits === 'speed' ? $_('quantities.speed') : $_('quantities.pace')} ({$_(
					'quantities.total'
				)} / {$_('quantities.moving')})</span
			>
		</Tooltip>
		<Tooltip>
			<span slot="data" class="flex flex-row items-center">
				<Timer size="18" class="mr-1" />
				<WithUnits value={statistics.global.time.total} type="time" />
				<span class="mx-1">/</span>
				<WithUnits value={statistics.global.time.moving} type="time" />
			</span>
			<span slot="tooltip"
				>{$_('quantities.time')} ({$_('quantities.total')} / {$_('quantities.moving')})</span
			>
		</Tooltip>
	</Card.Content>
</Card.Root>
