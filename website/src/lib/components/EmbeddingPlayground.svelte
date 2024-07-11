<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { basemaps } from '$lib/assets/layers';
	import { Zap, HeartPulse, Orbit, Thermometer, SquareActivity } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';

	let options = {
		files: ['https://raw.githubusercontent.com/gpxstudio/gpx.studio/main/gpx/test-data/simple.gpx'],
		basemap: 'mapboxOutdoors',
		elevation: {
			show: true,
			height: 170,
			data: [],
			fill: undefined,
			controls: true
		},
		distanceUnits: 'metric',
		velocityUnits: 'speed',
		temperatureUnits: 'celsius'
	};

	let files =
		'https://raw.githubusercontent.com/gpxstudio/gpx.studio/main/gpx/test-data/simple.gpx';

	$: if (files) {
		options.files = files.split(',');
	}

	let additionalData = {
		speed: false,
		hr: false,
		cad: false,
		temp: false,
		power: false
	};

	$: if (additionalData) {
		options.elevation.data = Object.keys(additionalData).filter((key) => additionalData[key]);
	}

	let manualCamera = false;

	let zoom = 0;
	let lat = 0;
	let lon = 0;
	let bearing = 0;
	let pitch = 0;

	$: hash = manualCamera ? `#${zoom}/${lat}/${lon}/${bearing}/${pitch}` : '';

	$: console.log(options);
</script>

<iframe
	src={`../../embed?options=${encodeURIComponent(JSON.stringify(options))}${hash}`}
	style="width: 100%; height: 600px;"
></iframe>

<Card.Root>
	<Card.Header>
		<Card.Title>Card Title</Card.Title>
		<Card.Description>Card Description</Card.Description>
	</Card.Header>
	<Card.Content>
		<fieldset class="flex flex-col gap-3">
			<Label for="file_urls">{$_('embedding.file_urls')}</Label>
			<Input id="file_urls" type="text" class="h-8" bind:value={files} />
			<Label for="basemap">{$_('embedding.basemap')}</Label>
			<Select.Root
				onSelectedChange={(selected) => {
					if (selected?.value) {
						options.basemap = selected?.value;
					}
				}}
			>
				<Select.Trigger id="basemap" class="w-[180px] h-8">
					<Select.Value />
				</Select.Trigger>
				<Select.Content class="max-h-60 overflow-y-scroll">
					{#each Object.keys(basemaps) as basemap}
						<Select.Item value={basemap}>{$_(`layers.label.${basemap}`)}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<div class="flex flex-row items-center gap-2">
				<Label for="profile">{$_('menu.elevation_profile')}</Label>
				<Checkbox id="profile" bind:checked={options.elevation.show} />
			</div>
			{#if options.elevation.show}
				<div class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-3 mt-1">
					<Label class="flex flex-row items-center gap-2">
						{$_('embedding.height')}
						<Input type="number" bind:value={options.elevation.height} class="h-8 w-20" />
					</Label>
					<div class="flex flex-row items-center gap-2">
						<span class="shrink-0">
							{$_('embedding.fill_by')}
						</span>
						<Select.Root
							onSelectedChange={(selected) => {
								if (selected?.value) {
									if (selected?.value === 'none') {
										options.elevation.fill = undefined;
									} else {
										options.elevation.fill = selected?.value;
									}
								}
							}}
						>
							<Select.Trigger class="grow h-8">
								<Select.Value />
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="slope">{$_('quantities.slope')}</Select.Item>
								<Select.Item value="surface">{$_('quantities.surface')}</Select.Item>
								<Select.Item value="none">{$_('embedding.none')}</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="controls" bind:checked={options.elevation.controls} />
						<Label for="controls">{$_('embedding.show_controls')}</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-speed" bind:checked={additionalData.speed} />
						<Label for="show-speed" class="flex flex-row items-center gap-1">
							<Zap size="16" />
							{$_('chart.show_speed')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-hr" bind:checked={additionalData.hr} />
						<Label for="show-hr" class="flex flex-row items-center gap-1">
							<HeartPulse size="16" />
							{$_('chart.show_heartrate')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-cad" bind:checked={additionalData.cad} />
						<Label for="show-cad" class="flex flex-row items-center gap-1">
							<Orbit size="16" />
							{$_('chart.show_cadence')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-temp" bind:checked={additionalData.temp} />
						<Label for="show-temp" class="flex flex-row items-center gap-1">
							<Thermometer size="16" />
							{$_('chart.show_temperature')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-power" bind:checked={additionalData.power} />
						<Label for="show-power" class="flex flex-row items-center gap-1">
							<SquareActivity size="16" />
							{$_('chart.show_power')}
						</Label>
					</div>
				</div>
			{/if}
			<div class="flex flex-row flex-wrap justify-between gap-3">
				<Label class="flex flex-col items-start gap-2">
					{$_('menu.distance_units')}
					<RadioGroup.Root bind:value={options.distanceUnits}>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="metric" id="metric" />
							<Label for="metric">{$_('menu.metric')}</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="imperial" id="imperial" />
							<Label for="imperial">{$_('menu.imperial')}</Label>
						</div>
					</RadioGroup.Root>
				</Label>
				<Label class="flex flex-col items-start gap-2">
					{$_('menu.velocity_units')}
					<RadioGroup.Root bind:value={options.velocityUnits}>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="speed" id="speed" />
							<Label for="speed">{$_('quantities.speed')}</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="pace" id="pace" />
							<Label for="pace">{$_('quantities.pace')}</Label>
						</div>
					</RadioGroup.Root>
				</Label>
				<Label class="flex flex-col items-start gap-2">
					{$_('menu.temperature_units')}
					<RadioGroup.Root bind:value={options.temperatureUnits}>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="celsius" id="celsius" />
							<Label for="celsius">{$_('menu.celsius')}</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="fahrenheit" id="fahrenheit" />
							<Label for="fahrenheit">{$_('menu.fahrenheit')}</Label>
						</div>
					</RadioGroup.Root>
				</Label>
			</div>
		</fieldset>
	</Card.Content>
</Card.Root>
