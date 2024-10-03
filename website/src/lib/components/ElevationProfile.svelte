<script lang="ts">
	import ButtonWithTooltip from '$lib/components/ButtonWithTooltip.svelte';
	import * as Popover from '$lib/components/ui/popover';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import Chart from 'chart.js/auto';
	import mapboxgl from 'mapbox-gl';
	import { map } from '$lib/stores';
	import { onDestroy, onMount } from 'svelte';
	import {
		BrickWall,
		TriangleRight,
		HeartPulse,
		Orbit,
		SquareActivity,
		Thermometer,
		Zap,
		Circle,
		Check,
		ChartNoAxesColumn,
		Construction
	} from 'lucide-svelte';
	import { surfaceColors, highwayColors } from '$lib/assets/colors';
	import { _, locale } from 'svelte-i18n';
	import {
		getCadenceWithUnits,
		getConvertedDistance,
		getConvertedElevation,
		getConvertedTemperature,
		getConvertedVelocity,
		getDistanceUnits,
		getDistanceWithUnits,
		getElevationWithUnits,
		getHeartRateWithUnits,
		getPowerWithUnits,
		getTemperatureWithUnits,
		getVelocityWithUnits
	} from '$lib/units';
	import type { Writable } from 'svelte/store';
	import { DateFormatter } from '@internationalized/date';
	import type { GPXStatistics } from 'gpx';
	import { settings } from '$lib/db';
	import { mode } from 'mode-watcher';

	export let gpxStatistics: Writable<GPXStatistics>;
	export let slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined>;
	export let additionalDatasets: string[];
	export let elevationFill: 'slope' | 'surface' | 'highway' | undefined;
	export let showControls: boolean = true;

	const { distanceUnits, velocityUnits, temperatureUnits } = settings;

	let df: DateFormatter;

	$: if ($locale) {
		df = new DateFormatter($locale, {
			dateStyle: 'medium',
			timeStyle: 'medium'
		});
	}

	let canvas: HTMLCanvasElement;
	let overlay: HTMLCanvasElement;
	let chart: Chart;

	Chart.defaults.font.family =
		'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

	let marker: mapboxgl.Marker | null = null;
	let dragging = false;
	let panning = false;

	let options = {
		animation: false,
		parsing: false,
		maintainAspectRatio: false,
		scales: {
			x: {
				type: 'linear',
				ticks: {
					callback: function (value: number) {
						return `${value.toFixed(1).replace(/\.0+$/, '')} ${getDistanceUnits()}`;
					},
					align: 'inner',
					maxRotation: 0
				}
			},
			y: {
				type: 'linear',
				ticks: {
					callback: function (value: number) {
						return getElevationWithUnits(value, false);
					}
				}
			}
		},
		datasets: {
			line: {
				pointRadius: 0,
				tension: 0.4,
				borderWidth: 2,
				cubicInterpolationMode: 'monotone'
			}
		},
		interaction: {
			mode: 'nearest',
			axis: 'x',
			intersect: false
		},
		plugins: {
			legend: {
				display: false
			},
			decimation: {
				enabled: true
			},
			tooltip: {
				enabled: () => !dragging && !panning,
				callbacks: {
					title: function () {
						return '';
					},
					label: function (context: Chart.TooltipContext) {
						let point = context.raw;
						if (context.datasetIndex === 0) {
							if ($map && marker) {
								if (dragging) {
									marker.remove();
								} else {
									marker.setLngLat(point.coordinates);
									marker.addTo($map);
								}
							}
							return `${$_('quantities.elevation')}: ${getElevationWithUnits(point.y, false)}`;
						} else if (context.datasetIndex === 1) {
							return `${$velocityUnits === 'speed' ? $_('quantities.speed') : $_('quantities.pace')}: ${getVelocityWithUnits(point.y, false)}`;
						} else if (context.datasetIndex === 2) {
							return `${$_('quantities.heartrate')}: ${getHeartRateWithUnits(point.y)}`;
						} else if (context.datasetIndex === 3) {
							return `${$_('quantities.cadence')}: ${getCadenceWithUnits(point.y)}`;
						} else if (context.datasetIndex === 4) {
							return `${$_('quantities.temperature')}: ${getTemperatureWithUnits(point.y, false)}`;
						} else if (context.datasetIndex === 5) {
							return `${$_('quantities.power')}: ${getPowerWithUnits(point.y)}`;
						}
					},
					afterBody: function (contexts: Chart.TooltipContext[]) {
						let context = contexts.filter((context) => context.datasetIndex === 0);
						if (context.length === 0) return;
						let point = context[0].raw;
						let slope = {
							at: point.slope.at.toFixed(1),
							segment: point.slope.segment.toFixed(1),
							length: getDistanceWithUnits(point.slope.length)
						};
						let surface = point.extensions.surface ? point.extensions.surface : 'unknown';
						let highway = point.extensions.highway ? point.extensions.highway : 'unknown';
						let sacScale = point.extensions.sac_scale;
						let mtbScale = point.extensions['mtb:scale'];

						let labels = [
							`    ${$_('quantities.distance')}: ${getDistanceWithUnits(point.x, false)}`,
							`    ${$_('quantities.slope')}: ${slope.at} %${elevationFill === 'slope' ? ` (${slope.length} @${slope.segment} %)` : ''}`
						];

						if (elevationFill === 'surface') {
							labels.push(
								`    ${$_('quantities.surface')}: ${$_(`toolbar.routing.surface.${surface}`)}`
							);
						}

						if (elevationFill === 'highway') {
							labels.push(
								`    ${$_('quantities.highway')}: ${$_(`toolbar.routing.highway.${highway}`)}${
									sacScale ? ` (${$_(`toolbar.routing.sac_scale.${sacScale}`)})` : ''
								}`
							);
							if (mtbScale) {
								labels.push(`    ${$_('toolbar.routing.mtb_scale')}: ${mtbScale}`);
							}
						}

						if (point.time) {
							labels.push(`    ${$_('quantities.time')}: ${df.format(point.time)}`);
						}

						return labels;
					}
				}
			},
			zoom: {
				pan: {
					enabled: true,
					mode: 'x',
					modifierKey: 'shift',
					onPanStart: function () {
						// hide tooltip
						panning = true;
						$slicedGPXStatistics = undefined;
					},
					onPanComplete: function () {
						panning = false;
					}
				},
				zoom: {
					wheel: {
						enabled: true
					},
					mode: 'x',
					onZoomStart: function ({ chart, event }: { chart: Chart; event: any }) {
						if (
							event.deltaY < 0 &&
							Math.abs(
								chart.getInitialScaleBounds().x.max / chart.options.plugins.zoom.limits.x.minRange -
									chart.getZoomLevel()
							) < 0.01
						) {
							// Disable wheel pan if zoomed in to the max, and zooming in
							return false;
						}

						$slicedGPXStatistics = undefined;
					}
				},
				limits: {
					x: {
						min: 'original',
						max: 'original',
						minRange: 1
					}
				}
			}
		},
		stacked: false,
		onResize: function () {
			updateOverlay();
		}
	};

	let datasets: string[] = ['speed', 'hr', 'cad', 'atemp', 'power'];
	datasets.forEach((id) => {
		options.scales[`y${id}`] = {
			type: 'linear',
			position: 'right',
			grid: {
				display: false
			},
			reverse: () => id === 'speed' && $velocityUnits === 'pace',
			display: false
		};
	});

	onMount(async () => {
		Chart.register((await import('chartjs-plugin-zoom')).default); // dynamic import to avoid SSR and 'window is not defined' error

		chart = new Chart(canvas, {
			type: 'line',
			data: {
				datasets: []
			},
			options,
			plugins: [
				{
					id: 'toggleMarker',
					events: ['mouseout'],
					afterEvent: function (chart: Chart, args: { event: Chart.ChartEvent }) {
						if (args.event.type === 'mouseout') {
							if ($map && marker) {
								marker.remove();
							}
						}
					}
				}
			]
		});

		// Map marker to show on hover
		let element = document.createElement('div');
		element.className = 'h-4 w-4 rounded-full bg-cyan-500 border-2 border-white';
		marker = new mapboxgl.Marker({
			element
		});

		let startIndex = 0;
		let endIndex = 0;
		function getIndex(evt) {
			const points = chart.getElementsAtEventForMode(
				evt,
				'x',
				{
					intersect: false
				},
				true
			);

			if (points.length === 0) {
				const rect = canvas.getBoundingClientRect();
				if (evt.x - rect.left <= chart.chartArea.left) {
					return 0;
				} else if (evt.x - rect.left >= chart.chartArea.right) {
					return $gpxStatistics.local.points.length - 1;
				} else {
					return undefined;
				}
			}

			let point = points.find((point) => point.element.raw);
			if (point) {
				return point.element.raw.index;
			} else {
				return points[0].index;
			}
		}

		let dragStarted = false;
		function onMouseDown(evt) {
			if (evt.shiftKey) {
				// Panning interaction
				return;
			}
			dragStarted = true;
			canvas.style.cursor = 'col-resize';
			startIndex = getIndex(evt);
		}
		function onMouseMove(evt) {
			if (dragStarted) {
				dragging = true;
				endIndex = getIndex(evt);
				if (endIndex !== undefined) {
					if (startIndex === undefined) {
						startIndex = endIndex;
					} else if (startIndex !== endIndex) {
						$slicedGPXStatistics = [
							$gpxStatistics.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)),
							Math.min(startIndex, endIndex),
							Math.max(startIndex, endIndex)
						];
					}
				}
			}
		}
		function onMouseUp(evt) {
			dragStarted = false;
			dragging = false;
			canvas.style.cursor = '';
			endIndex = getIndex(evt);
			if (startIndex === endIndex) {
				$slicedGPXStatistics = undefined;
			}
		}
		canvas.addEventListener('pointerdown', onMouseDown);
		canvas.addEventListener('pointermove', onMouseMove);
		canvas.addEventListener('pointerup', onMouseUp);
	});

	$: if (chart && $distanceUnits && $velocityUnits && $temperatureUnits) {
		let data = $gpxStatistics;

		// update data
		chart.data.datasets[0] = {
			label: $_('quantities.elevation'),
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.ele ? getConvertedElevation(point.ele) : 0,
					time: point.time,
					slope: {
						at: data.local.slope.at[index],
						segment: data.local.slope.segment[index],
						length: data.local.slope.length[index]
					},
					extensions: point.getExtensions(),
					coordinates: point.getCoordinates(),
					index: index
				};
			}),
			normalized: true,
			fill: 'start',
			order: 1
		};
		chart.data.datasets[1] = {
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: getConvertedVelocity(data.local.speed[index]),
					index: index
				};
			}),
			normalized: true,
			yAxisID: 'yspeed',
			hidden: true
		};
		chart.data.datasets[2] = {
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.getHeartRate(),
					index: index
				};
			}),
			normalized: true,
			yAxisID: 'yhr',
			hidden: true
		};
		chart.data.datasets[3] = {
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.getCadence(),
					index: index
				};
			}),
			normalized: true,
			yAxisID: 'ycad',
			hidden: true
		};
		chart.data.datasets[4] = {
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: getConvertedTemperature(point.getTemperature()),
					index: index
				};
			}),
			normalized: true,
			yAxisID: 'yatemp',
			hidden: true
		};
		chart.data.datasets[5] = {
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.getPower(),
					index: index
				};
			}),
			normalized: true,
			yAxisID: 'ypower',
			hidden: true
		};
		chart.options.scales.x['min'] = 0;
		chart.options.scales.x['max'] = getConvertedDistance(data.global.distance.total);

		chart.update();
	}

	let maxSlope = 20;
	function slopeFillCallback(context) {
		let slope = context.p0.raw.slope.segment;
		if (slope > maxSlope) {
			slope = maxSlope;
		} else if (slope < -maxSlope) {
			slope = -maxSlope;
		}

		let v = slope / maxSlope;
		v = 1 / (1 + Math.exp(-6 * v));
		v = v - 0.5;

		let hue = ((0.5 - v) * 120).toString(10);
		let lightness = 90 - Math.abs(v) * 70;

		return ['hsl(', hue, ',70%,', lightness, '%)'].join('');
	}

	function surfaceFillCallback(context) {
		let surface = context.p0.raw.extensions.surface;
		return surfaceColors[surface] ? surfaceColors[surface] : surfaceColors.missing;
	}

	function highwayFillCallback(context) {
		let highway = context.p0.raw.extensions.highway;
		return highwayColors[highway] ? highwayColors[highway] : highwayColors.missing;
	}

	$: if (chart) {
		if (elevationFill === 'slope') {
			chart.data.datasets[0]['segment'] = {
				backgroundColor: slopeFillCallback
			};
		} else if (elevationFill === 'surface') {
			chart.data.datasets[0]['segment'] = {
				backgroundColor: surfaceFillCallback
			};
		} else if (elevationFill === 'highway') {
			chart.data.datasets[0]['segment'] = {
				backgroundColor: highwayFillCallback
			};
		} else {
			chart.data.datasets[0]['segment'] = {};
		}
		chart.update();
	}

	$: if (additionalDatasets && chart) {
		let includeSpeed = additionalDatasets.includes('speed');
		let includeHeartRate = additionalDatasets.includes('hr');
		let includeCadence = additionalDatasets.includes('cad');
		let includeTemperature = additionalDatasets.includes('atemp');
		let includePower = additionalDatasets.includes('power');
		if (chart.data.datasets.length > 0) {
			chart.data.datasets[1].hidden = !includeSpeed;
			chart.data.datasets[2].hidden = !includeHeartRate;
			chart.data.datasets[3].hidden = !includeCadence;
			chart.data.datasets[4].hidden = !includeTemperature;
			chart.data.datasets[5].hidden = !includePower;
		}
		chart.update();
	}

	function updateOverlay() {
		if (!canvas) {
			return;
		}

		overlay.width = canvas.width / window.devicePixelRatio;
		overlay.height = canvas.height / window.devicePixelRatio;
		overlay.style.width = `${canvas.width}px`;
		overlay.style.height = `${canvas.height}px`;

		if ($slicedGPXStatistics) {
			let startIndex = $slicedGPXStatistics[1];
			let endIndex = $slicedGPXStatistics[2];

			// Draw selection rectangle
			let selectionContext = overlay.getContext('2d');
			if (selectionContext) {
				selectionContext.fillStyle = $mode === 'dark' ? 'white' : 'black';
				selectionContext.globalAlpha = $mode === 'dark' ? 0.2 : 0.1;
				selectionContext.clearRect(0, 0, overlay.width, overlay.height);

				let startPixel = chart.scales.x.getPixelForValue(
					getConvertedDistance($gpxStatistics.local.distance.total[startIndex])
				);
				let endPixel = chart.scales.x.getPixelForValue(
					getConvertedDistance($gpxStatistics.local.distance.total[endIndex])
				);

				selectionContext.fillRect(
					startPixel,
					chart.chartArea.top,
					endPixel - startPixel,
					chart.chartArea.height
				);
			}
		} else if (overlay) {
			let selectionContext = overlay.getContext('2d');
			if (selectionContext) {
				selectionContext.clearRect(0, 0, overlay.width, overlay.height);
			}
		}
	}

	$: $slicedGPXStatistics, $mode, updateOverlay();

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="h-full grow min-w-0 relative py-2">
	<canvas bind:this={overlay} class="w-full h-full absolute pointer-events-none"></canvas>
	<canvas bind:this={canvas} class="w-full h-full absolute"></canvas>
	{#if showControls}
		<div class="absolute bottom-10 right-1.5">
			<Popover.Root>
				<Popover.Trigger asChild let:builder>
					<ButtonWithTooltip
						label={$_('chart.settings')}
						builders={[builder]}
						variant="outline"
						class="w-7 h-7 p-0 flex justify-center opacity-70 hover:opacity-100 transition-opacity duration-300 hover:bg-background"
					>
						<ChartNoAxesColumn size="18" />
					</ButtonWithTooltip>
				</Popover.Trigger>
				<Popover.Content class="w-fit p-0 flex flex-col divide-y" side="top" sideOffset={-32}>
					<ToggleGroup.Root
						class="flex flex-col items-start gap-0 p-1"
						type="single"
						bind:value={elevationFill}
					>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="slope"
						>
							<div class="w-6 flex justify-center items-center">
								{#if elevationFill === 'slope'}
									<Circle class="h-1.5 w-1.5 fill-current text-current" />
								{/if}
							</div>
							<TriangleRight size="15" class="mr-1" />
							{$_('quantities.slope')}
						</ToggleGroup.Item>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="surface"
							variant="outline"
						>
							<div class="w-6 flex justify-center items-center">
								{#if elevationFill === 'surface'}
									<Circle class="h-1.5 w-1.5 fill-current text-current" />
								{/if}
							</div>
							<BrickWall size="15" class="mr-1" />
							{$_('quantities.surface')}
						</ToggleGroup.Item>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="highway"
							variant="outline"
						>
							<div class="w-6 flex justify-center items-center">
								{#if elevationFill === 'highway'}
									<Circle class="h-1.5 w-1.5 fill-current text-current" />
								{/if}
							</div>
							<Construction size="15" class="mr-1" />
							{$_('quantities.highway')}
						</ToggleGroup.Item>
					</ToggleGroup.Root>
					<ToggleGroup.Root
						class="flex flex-col items-start gap-0 p-1"
						type="multiple"
						bind:value={additionalDatasets}
					>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="speed"
						>
							<div class="w-6 flex justify-center items-center">
								{#if additionalDatasets.includes('speed')}
									<Check size="14" />
								{/if}
							</div>
							<Zap size="15" class="mr-1" />
							{$velocityUnits === 'speed' ? $_('quantities.speed') : $_('quantities.pace')}
						</ToggleGroup.Item>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="hr"
						>
							<div class="w-6 flex justify-center items-center">
								{#if additionalDatasets.includes('hr')}
									<Check size="14" />
								{/if}
							</div>
							<HeartPulse size="15" class="mr-1" />
							{$_('quantities.heartrate')}
						</ToggleGroup.Item>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="cad"
						>
							<div class="w-6 flex justify-center items-center">
								{#if additionalDatasets.includes('cad')}
									<Check size="14" />
								{/if}
							</div>
							<Orbit size="15" class="mr-1" />
							{$_('quantities.cadence')}
						</ToggleGroup.Item>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="atemp"
						>
							<div class="w-6 flex justify-center items-center">
								{#if additionalDatasets.includes('atemp')}
									<Check size="14" />
								{/if}
							</div>
							<Thermometer size="15" class="mr-1" />
							{$_('quantities.temperature')}
						</ToggleGroup.Item>
						<ToggleGroup.Item
							class="p-0 pr-1.5 h-6 w-full rounded flex justify-start data-[state=on]:bg-background data-[state=on]:hover:bg-accent hover:bg-accent hover:text-foreground"
							value="power"
						>
							<div class="w-6 flex justify-center items-center">
								{#if additionalDatasets.includes('power')}
									<Check size="14" />
								{/if}
							</div>
							<SquareActivity size="15" class="mr-1" />
							{$_('quantities.power')}
						</ToggleGroup.Item>
					</ToggleGroup.Root>
				</Popover.Content>
			</Popover.Root>
		</div>
	{/if}
</div>
