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
        Video,
    } from '@lucide/svelte';
    import { i18n } from '$lib/i18n.svelte';
    import {
        allowedEmbeddingBasemaps,
        defaultEmbeddingOptions,
        getCleanedEmbeddingOptions,
        getMergedEmbeddingOptions,
    } from './embedding';
    import { PUBLIC_MAPTILER_KEY } from '$env/static/public';
    import Embedding from './Embedding.svelte';
    import { onDestroy } from 'svelte';
    import { base } from '$app/paths';
    import { map } from '$lib/components/map/map';
    import { mode } from 'mode-watcher';

    let options = $state(
        getMergedEmbeddingOptions(
            {
                token: 'YOUR_MAPTILER_KEY',
                theme: mode.current,
            },
            defaultEmbeddingOptions
        )
    );
    let files = $state(
        'https://raw.githubusercontent.com/gpxstudio/gpx.studio/main/gpx/test-data/simple.gpx'
    );
    let driveIds = $state('');

    let iframeOptions = $derived(
        getMergedEmbeddingOptions(
            {
                token:
                    options.key.length === 0 || options.key === 'YOUR_MAPTILER_KEY'
                        ? PUBLIC_MAPTILER_KEY
                        : options.key,
                files: files.split(',').filter((url) => url.length > 0),
                ids: driveIds.split(',').filter((id) => id.length > 0),
                elevation: {
                    fill: options.elevation.fill === 'none' ? undefined : options.elevation.fill,
                },
            },
            options
        )
    );

    let manualCamera = $state(false);
    let zoom = $state('0');
    let lat = $state('0');
    let lon = $state('0');
    let bearing = $state('0');
    let pitch = $state('0');
    let hash = $derived(manualCamera ? `#${zoom}/${lat}/${lon}/${bearing}/${pitch}` : '');

    $effect(() => {
        if (options.elevation.show || options.elevation.height) {
            map.resize();
        }
    });

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

    map.onLoad((map_) => {
        map_.on('moveend', updateCamera);
    });

    onDestroy(() => {
        if ($map) {
            $map.off('moveend', updateCamera);
        }
    });
</script>

<Card.Root id="embedding-playground">
    <Card.Header>
        <Card.Title>{i18n._('embedding.title')}</Card.Title>
    </Card.Header>
    <Card.Content>
        <fieldset class="flex flex-col gap-3">
            <Label for="key">{i18n._('embedding.maptiler_key')}</Label>
            <Input id="key" type="text" class="h-8" bind:value={options.key} />
            <Label for="file_urls">{i18n._('embedding.file_urls')}</Label>
            <Input id="file_urls" type="text" class="h-8" bind:value={files} />
            <Label for="drive_ids">{i18n._('embedding.drive_ids')}</Label>
            <Input id="drive_ids" type="text" class="h-8" bind:value={driveIds} />
            <Label for="basemap">{i18n._('embedding.basemap')}</Label>
            <Select.Root type="single" bind:value={options.basemap}>
                <Select.Trigger id="basemap" class="w-full h-8">
                    {i18n._(`layers.label.${options.basemap}`)}
                </Select.Trigger>
                <Select.Content class="max-h-60 overflow-y-scroll">
                    {#each allowedEmbeddingBasemaps as basemap}
                        <Select.Item value={basemap}
                            >{i18n._(`layers.label.${basemap}`)}</Select.Item
                        >
                    {/each}
                </Select.Content>
            </Select.Root>
            <div class="flex flex-row items-center gap-2">
                <Label for="profile">{i18n._('menu.elevation_profile')}</Label>
                <Checkbox id="profile" bind:checked={options.elevation.show} />
            </div>
            {#if options.elevation.show}
                <div class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-3 mt-1">
                    <Label class="flex flex-row items-center gap-2">
                        {i18n._('embedding.height')}
                        <Input
                            type="number"
                            bind:value={options.elevation.height}
                            class="h-8 w-20"
                        />
                    </Label>
                    <div class="flex flex-row items-center gap-2">
                        <span class="shrink-0">
                            {i18n._('embedding.fill_by')}
                        </span>
                        <Select.Root type="single" bind:value={options.elevation.fill}>
                            <Select.Trigger class="grow h-8">
                                {options.elevation.fill !== 'none'
                                    ? i18n._(`quantities.${options.elevation.fill}`)
                                    : i18n._('embedding.none')}
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="slope">{i18n._('quantities.slope')}</Select.Item
                                >
                                <Select.Item value="surface"
                                    >{i18n._('quantities.surface')}</Select.Item
                                >
                                <Select.Item value="highway"
                                    >{i18n._('quantities.highway')}</Select.Item
                                >
                                <Select.Item value="none">{i18n._('embedding.none')}</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                        <Checkbox id="controls" bind:checked={options.elevation.controls} />
                        <Label for="controls">{i18n._('embedding.show_controls')}</Label>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                        <Checkbox id="show-speed" bind:checked={options.elevation.speed} />
                        <Label for="show-speed" class="flex flex-row items-center gap-1">
                            <Zap size="16" />
                            {i18n._('quantities.speed')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                        <Checkbox id="show-hr" bind:checked={options.elevation.hr} />
                        <Label for="show-hr" class="flex flex-row items-center gap-1">
                            <HeartPulse size="16" />
                            {i18n._('quantities.heartrate')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                        <Checkbox id="show-cad" bind:checked={options.elevation.cad} />
                        <Label for="show-cad" class="flex flex-row items-center gap-1">
                            <Orbit size="16" />
                            {i18n._('quantities.cadence')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                        <Checkbox id="show-temp" bind:checked={options.elevation.temp} />
                        <Label for="show-temp" class="flex flex-row items-center gap-1">
                            <Thermometer size="16" />
                            {i18n._('quantities.temperature')}
                        </Label>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                        <Checkbox id="show-power" bind:checked={options.elevation.power} />
                        <Label for="show-power" class="flex flex-row items-center gap-1">
                            <SquareActivity size="16" />
                            {i18n._('quantities.power')}
                        </Label>
                    </div>
                </div>
            {/if}
            <div class="flex flex-row items-center gap-2">
                <Checkbox id="distance-markers" bind:checked={options.distanceMarkers} />
                <Label for="distance-markers" class="flex flex-row items-center gap-1">
                    <Coins size="16" />
                    {i18n._('menu.distance_markers')}
                </Label>
            </div>
            <div class="flex flex-row items-center gap-2">
                <Checkbox id="direction-markers" bind:checked={options.directionMarkers} />
                <Label for="direction-markers" class="flex flex-row items-center gap-1">
                    <Milestone size="16" />
                    {i18n._('menu.direction_markers')}
                </Label>
            </div>
            <div class="flex flex-row flex-wrap justify-between gap-3">
                <Label class="flex flex-col items-start gap-2">
                    {i18n._('menu.distance_units')}
                    <RadioGroup.Root bind:value={options.distanceUnits}>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="metric" id="metric" />
                            <Label for="metric">{i18n._('menu.metric')}</Label>
                        </div>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="imperial" id="imperial" />
                            <Label for="imperial">{i18n._('menu.imperial')}</Label>
                        </div>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="nautical" id="nautical" />
                            <Label for="nautical">{i18n._('menu.nautical')}</Label>
                        </div>
                    </RadioGroup.Root>
                </Label>
                <Label class="flex flex-col items-start gap-2">
                    {i18n._('menu.velocity_units')}
                    <RadioGroup.Root bind:value={options.velocityUnits}>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="speed" id="speed" />
                            <Label for="speed">{i18n._('quantities.speed')}</Label>
                        </div>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="pace" id="pace" />
                            <Label for="pace">{i18n._('quantities.pace')}</Label>
                        </div>
                    </RadioGroup.Root>
                </Label>
                <Label class="flex flex-col items-start gap-2">
                    {i18n._('menu.temperature_units')}
                    <RadioGroup.Root bind:value={options.temperatureUnits}>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="celsius" id="celsius" />
                            <Label for="celsius">{i18n._('menu.celsius')}</Label>
                        </div>
                        <div class="flex items-center space-x-2">
                            <RadioGroup.Item value="fahrenheit" id="fahrenheit" />
                            <Label for="fahrenheit">{i18n._('menu.fahrenheit')}</Label>
                        </div>
                    </RadioGroup.Root>
                </Label>
            </div>
            <Label class="flex flex-col items-start gap-2">
                {i18n._('menu.mode')}
                <RadioGroup.Root bind:value={options.theme} class="flex flex-row">
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="system" id="system" />
                        <Label for="system">{i18n._('menu.system')}</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="light" id="light" />
                        <Label for="light">{i18n._('menu.light')}</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="dark" id="dark" />
                        <Label for="dark">{i18n._('menu.dark')}</Label>
                    </div>
                </RadioGroup.Root>
            </Label>
            <div class="flex flex-col gap-3 p-3 border rounded-md">
                <div class="flex flex-row items-center gap-2">
                    <Checkbox id="manual-camera" bind:checked={manualCamera} />
                    <Label for="manual-camera" class="flex flex-row items-center gap-1">
                        <Video size="16" />
                        {i18n._('embedding.manual_camera')}
                    </Label>
                </div>
                <p class="text-sm text-muted-foreground">
                    {i18n._('embedding.manual_camera_description')}
                </p>
                <div class="flex flex-row flex-wrap items-center gap-6">
                    <Label class="flex flex-col gap-1">
                        <span>{i18n._('embedding.latitude')}</span>
                        <span>{lat}</span>
                    </Label>
                    <Label class="flex flex-col gap-1">
                        <span>{i18n._('embedding.longitude')}</span>
                        <span>{lon}</span>
                    </Label>
                    <Label class="flex flex-col gap-1">
                        <span>{i18n._('embedding.zoom')}</span>
                        <span>{zoom}</span>
                    </Label>
                    <Label class="flex flex-col gap-1">
                        <span>{i18n._('embedding.bearing')}</span>
                        <span>{bearing}</span>
                    </Label>
                    <Label class="flex flex-col gap-1">
                        <span>{i18n._('embedding.pitch')}</span>
                        <span>{pitch}</span>
                    </Label>
                </div>
            </div>
            <Label>
                {i18n._('embedding.preview')}
            </Label>
            <div class="relative h-[600px]">
                <Embedding options={iframeOptions} bind:hash useHash={false} />
            </div>
            <Label>
                {i18n._('embedding.code')}
            </Label>
            <pre
                class="bg-primary text-primary-foreground p-3 rounded-md whitespace-normal break-all">
                <code class="language-html">
                    {`<iframe src="https://gpx.studio${base}/embed?options=${encodeURIComponent(JSON.stringify(getCleanedEmbeddingOptions(iframeOptions)))}${hash}" width="100%" height="600px" frameborder="0" style="outline: none;"/>`}
                </code>
            </pre>
        </fieldset>
    </Card.Content>
</Card.Root>
