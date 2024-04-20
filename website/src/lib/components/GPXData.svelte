<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import GPXDataItem from '$lib/components/GPXDataItem.svelte';

	import { GPXStatistics } from 'gpx';

	import { selectedFiles } from '$lib/stores';
	import { MoveDownRight, MoveUpRight, Ruler, Timer, Zap } from 'lucide-svelte';

	let gpxData: GPXStatistics = new GPXStatistics();

	$: {
		gpxData = new GPXStatistics();
		$selectedFiles.forEach((file) => {
			gpxData.mergeWith(file.statistics);
		});
	}

	function toHHMMSS(seconds: number) {
		var hours = Math.floor(seconds / 3600);
		var minutes = Math.floor(seconds / 60) % 60;
		var seconds = Math.round(seconds % 60);

		return [hours, minutes, seconds]
			.map((v) => (v < 10 ? '0' + v : v))
			.filter((v, i) => v !== '00' || i > 0)
			.join(':');
	}
</script>

<Card.Root class="h-full overflow-hidden border-none">
	<Card.Content class="h-full flex flex-col flex-wrap gap-4 p-4 justify-center">
		<GPXDataItem>
			<span slot="data" class="flex flex-row items-center">
				<Ruler size="18" class="mr-1" />
				{gpxData.distance.total.toFixed(2)} km
			</span>
			<span slot="tooltip">Distance</span>
		</GPXDataItem>
		<GPXDataItem>
			<span slot="data" class="flex flex-row items-center">
				<MoveUpRight size="18" class="mr-1" />
				{gpxData.elevation.gain.toFixed(0)} m
				<MoveDownRight size="18" class="mx-1" />
				{gpxData.elevation.loss.toFixed(0)} m
			</span>
			<span slot="tooltip">Elevation</span>
		</GPXDataItem>
		<GPXDataItem>
			<span slot="data" class="flex flex-row items-center">
				<Zap size="18" class="mr-1" />
				{gpxData.speed.moving.toFixed(2)} km/h
			</span>
			<span slot="tooltip">Time</span>
		</GPXDataItem>
		<GPXDataItem>
			<span slot="data" class="flex flex-row items-center">
				<Timer size="18" class="mr-1" />
				{toHHMMSS(gpxData.time.moving)} / {toHHMMSS(gpxData.time.total)}
			</span>
			<span slot="tooltip">Moving time / Total time</span>
		</GPXDataItem>
	</Card.Content>
</Card.Root>
