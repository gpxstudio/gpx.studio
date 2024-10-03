<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import {
		Zap,
		HeartPulse,
		Orbit,
		Thermometer,
		SquareActivity,
		Coins,
		Milestone,
		Video
	} from 'lucide-svelte';
	import { _ } from 'svelte-i18n';
	import {
		allowedEmbeddingBasemaps,
		getCleanedEmbeddingOptions,
		getDefaultEmbeddingOptions
	} from './Embedding';
	import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
	import Embedding from './Embedding.svelte';
	import { map } from '$lib/stores';
	import { tick } from 'svelte';
	import { base } from '$app/paths';

	let options = getDefaultEmbeddingOptions();
	options.token = 'YOUR_MAPBOX_TOKEN';
	options.files = [
		'https://raw.githubusercontent.com/gpxstudio/gpx.studio/main/gpx/test-data/simple.gpx'
	];

	let files = options.files[0];
	$: {
		let urls = files.split(',');
		urls = urls.filter((url) => url.length > 0);
		if (JSON.stringify(urls) !== JSON.stringify(options.files)) {
			options.files = urls;
		}
	}
	let driveIds = '';
	$: {
		let ids = driveIds.split(',');
		ids = ids.filter((id) => id.length > 0);
		if (JSON.stringify(ids) !== JSON.stringify(options.ids)) {
			options.ids = ids;
		}
	}

	let manualCamera = false;

	let zoom = '0';
	let lat = '0';
	let lon = '0';
	let bearing = '0';
	let pitch = '0';

	$: hash = manualCamera ? `#${zoom}/${lat}/${lon}/${bearing}/${pitch}` : '';

	$: iframeOptions =
		options.token.length === 0 || options.token === 'YOUR_MAPBOX_TOKEN'
			? Object.assign({}, options, { token: PUBLIC_MAPBOX_TOKEN })
			: options;

	async function resizeMap() {
		if ($map) {
			await tick();
			$map.resize();
		}
	}

	$: if (options.elevation.height || options.elevation.show) {
		resizeMap();
	}

	function updateCamera() {
		if ($map) {
			let center = $map.getCenter();
			lat = center.lat.toFixed(4);
			lon = center.lng.toFixed(4);
			zoom = $map.getZoom().toFixed(2);
			bearing = $map.getBearing().toFixed(1);
			pitch = $map.getPitch().toFixed(0);
		}
	}

	$: if ($map) {
		$map.on('moveend', updateCamera);
	}
</script>

<Card.Root id="embedding-playground">
	<Card.Header>
		<Card.Title>{$_('embedding.title')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<fieldset class="flex flex-col gap-3">
			<Label for="token">{$_('embedding.mapbox_token')}</Label>
			<Input id="token" type="text" class="h-8" bind:value={options.token} />
			<Label for="file_urls">{$_('embedding.file_urls')}</Label>
			<Input id="file_urls" type="text" class="h-8" bind:value={files} />
			<Label for="drive_ids">{$_('embedding.drive_ids')}</Label>
			<Input id="drive_ids" type="text" class="h-8" bind:value={driveIds} />
			<Label for="basemap">{$_('embedding.basemap')}</Label>
			<Select.Root
				selected={{ value: options.basemap, label: $_(`layers.label.${options.basemap}`) }}
				onSelectedChange={(selected) => {
					if (selected?.value) {
						options.basemap = selected?.value;
					}
				}}
			>
				<Select.Trigger id="basemap" class="w-full h-8">
					<Select.Value />
				</Select.Trigger>
				<Select.Content class="max-h-60 overflow-y-scroll">
					{#each allowedEmbeddingBasemaps as basemap}
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
							selected={{ value: 'none', label: $_('embedding.none') }}
							onSelectedChange={(selected) => {
								let value = selected?.value;
								if (value === 'none') {
									options.elevation.fill = undefined;
								} else if (value === 'slope' || value === 'surface') {
									options.elevation.fill = value;
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
						<Checkbox id="show-speed" bind:checked={options.elevation.speed} />
						<Label for="show-speed" class="flex flex-row items-center gap-1">
							<Zap size="16" />
							{$_('quantities.speed')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-hr" bind:checked={options.elevation.hr} />
						<Label for="show-hr" class="flex flex-row items-center gap-1">
							<HeartPulse size="16" />
							{$_('quantities.heartrate')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-cad" bind:checked={options.elevation.cad} />
						<Label for="show-cad" class="flex flex-row items-center gap-1">
							<Orbit size="16" />
							{$_('quantities.cadence')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-temp" bind:checked={options.elevation.temp} />
						<Label for="show-temp" class="flex flex-row items-center gap-1">
							<Thermometer size="16" />
							{$_('quantities.temperature')}
						</Label>
					</div>
					<div class="flex flex-row items-center gap-2">
						<Checkbox id="show-power" bind:checked={options.elevation.power} />
						<Label for="show-power" class="flex flex-row items-center gap-1">
							<SquareActivity size="16" />
							{$_('quantities.power')}
						</Label>
					</div>
				</div>
			{/if}
			<div class="flex flex-row items-center gap-2">
				<Checkbox id="distance-markers" bind:checked={options.distanceMarkers} />
				<Label for="distance-markers" class="flex flex-row items-center gap-1">
					<Coins size="16" />
					{$_('menu.distance_markers')}
				</Label>
			</div>
			<div class="flex flex-row items-center gap-2">
				<Checkbox id="direction-markers" bind:checked={options.directionMarkers} />
				<Label for="direction-markers" class="flex flex-row items-center gap-1">
					<Milestone size="16" />
					{$_('menu.direction_markers')}
				</Label>
			</div>
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
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="nautical" id="nautical" />
							<Label for="nautical">{$_('menu.nautical')}</Label>
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
			<Label class="flex flex-col items-start gap-2">
				{$_('menu.mode')}
				<RadioGroup.Root bind:value={options.theme} class="flex flex-row">
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="system" id="system" />
						<Label for="system">{$_('menu.system')}</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="light" id="light" />
						<Label for="light">{$_('menu.light')}</Label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="dark" id="dark" />
						<Label for="dark">{$_('menu.dark')}</Label>
					</div>
				</RadioGroup.Root>
			</Label>
			<div class="flex flex-col gap-3 p-3 border rounded-md">
				<div class="flex flex-row items-center gap-2">
					<Checkbox id="manual-camera" bind:checked={manualCamera} />
					<Label for="manual-camera" class="flex flex-row items-center gap-1">
						<Video size="16" />
						{$_('embedding.manual_camera')}
					</Label>
				</div>
				<p class="text-sm text-muted-foreground">
					{$_('embedding.manual_camera_description')}
				</p>
				<div class="flex flex-row flex-wrap items-center gap-6">
					<Label class="flex flex-col gap-1">
						<span>{$_('embedding.latitude')}</span>
						<span>{lat}</span>
					</Label>
					<Label class="flex flex-col gap-1">
						<span>{$_('embedding.longitude')}</span>
						<span>{lon}</span>
					</Label>
					<Label class="flex flex-col gap-1">
						<span>{$_('embedding.zoom')}</span>
						<span>{zoom}</span>
					</Label>
					<Label class="flex flex-col gap-1">
						<span>{$_('embedding.bearing')}</span>
						<span>{bearing}</span>
					</Label>
					<Label class="flex flex-col gap-1">
						<span>{$_('embedding.pitch')}</span>
						<span>{pitch}</span>
					</Label>
				</div>
			</div>
			<Label>
				{$_('embedding.preview')}
			</Label>
			<div class="relative h-[600px]">
				<Embedding bind:options={iframeOptions} bind:hash useHash={false} />
			</div>
			<Label>
				{$_('embedding.code')}
			</Label>
			<pre class="bg-primary text-primary-foreground p-3 rounded-md whitespace-normal break-all">
                <code class="language-html">
                    {`<iframe src="https://gpx.studio${base}/embed?options=${encodeURIComponent(JSON.stringify(getCleanedEmbeddingOptions(options)))}${hash}" width="100%" height="600px" frameborder="0" style="outline: none;"/>`}
                </code>
            </pre>
		</fieldset>
	</Card.Content>
</Card.Root>
