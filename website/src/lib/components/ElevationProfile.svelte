<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { Separator } from '$lib/components/ui/separator';

	import Chart from 'chart.js/auto';
	import mapboxgl from 'mapbox-gl';

	import { map, gpxStatistics, slicedGPXStatistics } from '$lib/stores';
	import { settings } from '$lib/db';

	import { onDestroy, onMount } from 'svelte';
	import {
		BrickWall,
		TriangleRight,
		HeartPulse,
		Orbit,
		SquareActivity,
		Thermometer,
		Zap
	} from 'lucide-svelte';
	import { surfaceColors } from '$lib/assets/surfaces';

	import { _ } from 'svelte-i18n';
	import {
		getCadenceUnits,
		getCadenceWithUnits,
		getConvertedDistance,
		getConvertedElevation,
		getConvertedTemperature,
		getConvertedVelocity,
		getDistanceUnits,
		getDistanceWithUnits,
		getElevationWithUnits,
		getHeartRateUnits,
		getHeartRateWithUnits,
		getPowerUnits,
		getPowerWithUnits,
		getTemperatureUnits,
		getTemperatureWithUnits,
		getVelocityUnits,
		getVelocityWithUnits,
		secondsToHHMMSS
	} from '$lib/units';
	import { get } from 'svelte/store';

	let canvas: HTMLCanvasElement;
	let overlay: HTMLCanvasElement;
	let chart: Chart;

	Chart.defaults.font.family =
		'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

	let elevationFill: string;
	let additionalDatasets: string[];

	let marker: mapboxgl.Marker | null = null;
	let dragging = false;

	let { distanceUnits, velocityUnits, temperatureUnits } = settings;

	let options = {
		animation: false,
		parsing: false,
		maintainAspectRatio: false,
		scales: {
			x: {
				type: 'linear',
				ticks: {
					callback: function (value: number, index: number, ticks: { value: number }[]) {
						if (index === ticks.length - 1) {
							return `${value.toFixed(1).replace(/\.0+$/, '')}`;
						}
						return `${value.toFixed(1).replace(/\.0+$/, '')} ${getDistanceUnits()}`;
					}
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
				borderWidth: 2
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
				enabled: () => !dragging,
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
									marker.addTo($map);
									marker.setLngLat(point.coordinates);
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
						let slope = point.slope.toFixed(1);
						let surface = point.surface ? point.surface : 'unknown';

						return [
							`    ${$_('quantities.distance')}: ${getDistanceWithUnits(point.x, false)}`,
							`    ${$_('quantities.slope')}: ${slope} %`,
							`    ${$_('quantities.surface')}: ${$_(`toolbar.routing.surface.${surface}`)}`
						];
					}
				}
			}
		},
		stacked: false,
		onResize: function (chart, size) {
			overlay.width = size.width;
			overlay.height = size.height;
		}
	};

	let datasets: {
		[key: string]: {
			id: string;
			getLabel: () => string;
			getUnits: () => string;
		};
	} = {
		speed: {
			id: 'speed',
			getLabel: () => ($velocityUnits === 'speed' ? $_('quantities.speed') : $_('quantities.pace')),
			getUnits: () => getVelocityUnits()
		},
		hr: {
			id: 'hr',
			getLabel: () => $_('quantities.heartrate'),
			getUnits: () => getHeartRateUnits()
		},
		cad: {
			id: 'cad',
			getLabel: () => $_('quantities.cadence'),
			getUnits: () => getCadenceUnits()
		},
		atemp: {
			id: 'atemp',
			getLabel: () => $_('quantities.temperature'),
			getUnits: () => getTemperatureUnits()
		},
		power: {
			id: 'power',
			getLabel: () => $_('quantities.power'),
			getUnits: () => getPowerUnits()
		}
	};

	for (let [id, dataset] of Object.entries(datasets)) {
		options.scales[`y${id}`] = {
			type: 'linear',
			position: 'right',
			title: {
				display: true,
				text: dataset.getLabel() + ' (' + dataset.getUnits() + ')',
				padding: {
					top: 6,
					bottom: 0
				}
			},
			grid: {
				display: false
			},
			reverse: () => id === 'speed' && $velocityUnits === 'pace',
			display: false
		};
	}
	options.scales.yspeed['ticks'] = {
		callback: function (value: number) {
			if ($velocityUnits === 'speed') {
				return value;
			} else {
				return secondsToHHMMSS(value);
			}
		}
	};

	onMount(() => {
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

		// Overlay canvas to create a selection rectangle
		overlay.width = canvas.width;
		overlay.height = canvas.height;

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
			const rect = canvas.getBoundingClientRect();

			if (points.length === 0) {
				return evt.x - rect.left <= chart.chartArea.left
					? 0
					: get(gpxStatistics).local.points.length - 1;
			}
			let point = points.find((point) => point.element.raw);
			if (point) {
				return point.element.raw.index;
			} else {
				return points[0].index;
			}
		}
		canvas.addEventListener('pointerdown', (evt) => {
			dragging = true;
			canvas.style.cursor = 'col-resize';
			startIndex = getIndex(evt);
		});
		canvas.addEventListener('pointermove', (evt) => {
			if (dragging) {
				endIndex = getIndex(evt);
				if (startIndex !== endIndex) {
					slicedGPXStatistics.set([
						get(gpxStatistics).slice(
							Math.min(startIndex, endIndex),
							Math.max(startIndex, endIndex)
						),
						Math.min(startIndex, endIndex),
						Math.max(startIndex, endIndex)
					]);
				}
			}
		});
		canvas.addEventListener('pointerup', (evt) => {
			dragging = false;
			canvas.style.cursor = '';
			endIndex = getIndex(evt);
			if (startIndex === endIndex) {
				slicedGPXStatistics.set(undefined);
			}
		});
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
					slope: data.local.slope[index],
					surface: point.getSurface(),
					coordinates: point.getCoordinates(),
					index: index
				};
			}),
			normalized: true,
			fill: 'start',
			order: 1
		};
		chart.data.datasets[1] = {
			label: datasets.speed.getLabel(),
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: getConvertedVelocity(data.local.speed[index]),
					index: index
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.speed.id}`,
			hidden: true
		};
		chart.data.datasets[2] = {
			label: datasets.hr.getLabel(),
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.getHeartRate(),
					index: index
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.hr.id}`,
			hidden: true
		};
		chart.data.datasets[3] = {
			label: datasets.cad.getLabel(),
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.getCadence(),
					index: index
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.cad.id}`,
			hidden: true
		};
		chart.data.datasets[4] = {
			label: datasets.atemp.getLabel(),
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: getConvertedTemperature(point.getTemperature()),
					index: index
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.atemp.id}`,
			hidden: true
		};
		chart.data.datasets[5] = {
			label: datasets.power.getLabel(),
			data: data.local.points.map((point, index) => {
				return {
					x: getConvertedDistance(data.local.distance.total[index]),
					y: point.getPower(),
					index: index
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.power.id}`,
			hidden: true
		};
		chart.options.scales.x['min'] = 0;
		chart.options.scales.x['max'] = getConvertedDistance(data.global.distance.total);

		// update units
		for (let [id, dataset] of Object.entries(datasets)) {
			chart.options.scales[`y${id}`].title.text =
				dataset.getLabel() + ' (' + dataset.getUnits() + ')';
		}

		chart.update();
	}

	let slopeColors = [
		'#046307',
		'#028306',
		'#2AA12E',
		'#53BF56',
		'#7BDD7E',
		'#A4FBA6',
		'#edf0bd',
		'#ffcc99',
		'#F29898',
		'#E07575',
		'#CF5352',
		'#BE312F',
		'#AD0F0C'
	];

	function slopeFillCallback(context) {
		let slope = context.p0.raw.slope;
		if (slope <= 1 && slope >= -1) return slopeColors[6];
		else if (slope > 0) {
			if (slope <= 3) return slopeColors[7];
			else if (slope <= 5) return slopeColors[8];
			else if (slope <= 7) return slopeColors[9];
			else if (slope <= 10) return slopeColors[10];
			else if (slope <= 15) return slopeColors[11];
			else return slopeColors[12];
		} else {
			if (slope >= -3) return slopeColors[5];
			else if (slope >= -5) return slopeColors[4];
			else if (slope >= -7) return slopeColors[3];
			else if (slope >= -10) return slopeColors[2];
			else if (slope >= -15) return slopeColors[1];
			else return slopeColors[0];
		}
	}

	function surfaceFillCallback(context) {
		let surface = context.p0.raw.surface;
		return surfaceColors[surface] ? surfaceColors[surface] : surfaceColors.missing;
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
		chart.options.scales[`y${datasets.speed.id}`].display = includeSpeed;
		chart.options.scales[`y${datasets.hr.id}`].display = includeHeartRate;
		chart.options.scales[`y${datasets.cad.id}`].display = includeCadence;
		chart.options.scales[`y${datasets.atemp.id}`].display = includeTemperature;
		chart.options.scales[`y${datasets.power.id}`].display = includePower;
		chart.update();
	}

	$: if ($slicedGPXStatistics) {
		let startIndex = $slicedGPXStatistics[1];
		let endIndex = $slicedGPXStatistics[2];

		// Draw selection rectangle
		let selectionContext = overlay.getContext('2d');
		if (selectionContext) {
			selectionContext.globalAlpha = 0.1;
			selectionContext.clearRect(0, 0, overlay.width, overlay.height);

			let startPixel = chart.scales.x.getPixelForValue(
				getConvertedDistance(get(gpxStatistics).local.distance.total[startIndex])
			);
			let endPixel = chart.scales.x.getPixelForValue(
				getConvertedDistance(get(gpxStatistics).local.distance.total[endIndex])
			);

			selectionContext.fillRect(
				startPixel,
				chart.chartArea.top,
				endPixel - startPixel,
				chart.chartArea.bottom - chart.chartArea.top
			);
		}
	} else if (overlay) {
		let selectionContext = overlay.getContext('2d');
		if (selectionContext) {
			selectionContext.clearRect(0, 0, overlay.width, overlay.height);
		}
	}

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="h-full grow min-w-0 flex flex-row gap-4 items-center py-2 pr-4">
	<div class="h-full grow min-w-0">
		<canvas bind:this={overlay} class="absolute pointer-events-none"></canvas>
		<canvas bind:this={canvas} class="w-full h-full"></canvas>
	</div>
	<div class="w-fit flex flex-col border rounded">
		<ToggleGroup.Root class="flex-col gap-0" type="single" bind:value={elevationFill}>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="slope">
				<Tooltip side="left">
					<TriangleRight slot="data" size="16" />
					<span slot="tooltip">{$_('chart.show_slope')}</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="surface">
				<Tooltip side="left">
					<BrickWall slot="data" size="16" />
					<span slot="tooltip">{$_('chart.show_surface')}</span>
				</Tooltip>
			</ToggleGroup.Item>
		</ToggleGroup.Root>
		<Separator />
		<ToggleGroup.Root class="flex-col gap-0" type="multiple" bind:value={additionalDatasets}>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="speed">
				<Tooltip side="left">
					<Zap slot="data" size="16" />
					<span slot="tooltip"
						>{$velocityUnits === 'speed' ? $_('chart.show_speed') : $_('chart.show_pace')}</span
					>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="hr">
				<Tooltip side="left">
					<HeartPulse slot="data" size="16" />
					<span slot="tooltip">{$_('chart.show_heartrate')}</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="cad">
				<Tooltip side="left">
					<Orbit slot="data" size="16" />
					<span slot="tooltip">{$_('chart.show_cadence')}</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="atemp">
				<Tooltip side="left">
					<Thermometer slot="data" size="16" />
					<span slot="tooltip">{$_('chart.show_temperature')}</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-6 h-6" value="power">
				<Tooltip side="left">
					<SquareActivity slot="data" size="16" />
					<span slot="tooltip">{$_('chart.show_power')}</span>
				</Tooltip>
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	</div>
</div>
