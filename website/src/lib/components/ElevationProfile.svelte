<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import Tooltip from '$lib/components/Tooltip.svelte';
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
		Zap
	} from 'lucide-svelte';
	import { surfaceColors } from '$lib/assets/surfaces';
	import { _, locale } from 'svelte-i18n';
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
	import type { Writable } from 'svelte/store';
	import { DateFormatter } from '@internationalized/date';
	import type { GPXStatistics } from 'gpx';
	import { settings } from '$lib/db';

	export let gpxStatistics: Writable<GPXStatistics>;
	export let slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined>;
	export let panelSize: number;
	export let additionalDatasets: string[];
	export let elevationFill: 'slope' | 'surface' | undefined;
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
	let showAdditionalScales = true;
	let updateShowAdditionalScales = () => {
		showAdditionalScales = canvas.width / window.devicePixelRatio >= 600;
	};
	let overlay: HTMLCanvasElement;
	let chart: Chart;

	Chart.defaults.font.family =
		'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

	let marker: mapboxgl.Marker | null = null;
	let dragging = false;

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
						let surface = point.surface ? point.surface : 'unknown';

						let labels = [
							`    ${$_('quantities.distance')}: ${getDistanceWithUnits(point.x, false)}`,
							`    ${$_('quantities.slope')}: ${slope.at} %${elevationFill === 'slope' ? ` (${slope.length} @${slope.segment} %)` : ''}`
						];

						if (elevationFill === 'surface') {
							labels.push(
								`    ${$_('quantities.surface')}: ${$_(`toolbar.routing.surface.${surface}`)}`
							);
						}

						if (point.time) {
							labels.push(`    ${$_('quantities.time')}: ${df.format(point.time)}`);
						}

						return labels;
					}
				}
			}
		},
		stacked: false,
		onResize: function () {
			updateOverlay();
			updateShowAdditionalScales();
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

		updateShowAdditionalScales();

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
		chart.options.scales[`y${datasets.speed.id}`].display = includeSpeed && showAdditionalScales;
		chart.options.scales[`y${datasets.hr.id}`].display = includeHeartRate && showAdditionalScales;
		chart.options.scales[`y${datasets.cad.id}`].display = includeCadence && showAdditionalScales;
		chart.options.scales[`y${datasets.atemp.id}`].display =
			includeTemperature && showAdditionalScales;
		chart.options.scales[`y${datasets.power.id}`].display = includePower && showAdditionalScales;
		chart.update();
	}

	function updateOverlay() {
		if (!canvas) {
			return;
		}

		overlay.width = canvas.width / window.devicePixelRatio;
		overlay.height = canvas.height / window.devicePixelRatio;

		if ($slicedGPXStatistics) {
			let startIndex = $slicedGPXStatistics[1];
			let endIndex = $slicedGPXStatistics[2];

			// Draw selection rectangle
			let selectionContext = overlay.getContext('2d');
			if (selectionContext) {
				selectionContext.globalAlpha = 0.1;
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
					chart.chartArea.bottom - chart.chartArea.top
				);
			}
		} else if (overlay) {
			let selectionContext = overlay.getContext('2d');
			if (selectionContext) {
				selectionContext.clearRect(0, 0, overlay.width, overlay.height);
			}
		}
	}

	$: $slicedGPXStatistics, updateOverlay();

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="h-full grow min-w-0 flex flex-row gap-4 items-center {$$props.class ?? ''}">
	<div class="grow h-full min-w-0 relative">
		<canvas bind:this={overlay} class=" w-full h-full absolute pointer-events-none"></canvas>
		<canvas bind:this={canvas} class="w-full h-full"></canvas>
	</div>
	{#if showControls}
		<div class="h-full flex flex-col justify-center" style="width: {panelSize > 158 ? 22 : 42}px">
			<ToggleGroup.Root
				class="{panelSize > 158
					? 'flex-col'
					: 'flex-row'} flex-wrap gap-0 min-h-0 content-center border rounded-t-md"
				type="single"
				bind:value={elevationFill}
			>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="slope">
					<Tooltip side="left">
						<TriangleRight slot="data" size="15" />
						<span slot="tooltip">{$_('chart.show_slope')}</span>
					</Tooltip>
				</ToggleGroup.Item>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="surface">
					<Tooltip side="left">
						<BrickWall slot="data" size="15" />
						<span slot="tooltip">{$_('chart.show_surface')}</span>
					</Tooltip>
				</ToggleGroup.Item>
			</ToggleGroup.Root>
			<ToggleGroup.Root
				class="{panelSize > 158
					? 'flex-col'
					: 'flex-row'} flex-wrap gap-0 min-h-0 content-center border rounded-b-md -mt-[1px]"
				type="multiple"
				bind:value={additionalDatasets}
			>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="speed">
					<Tooltip side="left">
						<Zap slot="data" size="15" />
						<span slot="tooltip"
							>{$velocityUnits === 'speed' ? $_('chart.show_speed') : $_('chart.show_pace')}</span
						>
					</Tooltip>
				</ToggleGroup.Item>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="hr">
					<Tooltip side="left">
						<HeartPulse slot="data" size="15" />
						<span slot="tooltip">{$_('chart.show_heartrate')}</span>
					</Tooltip>
				</ToggleGroup.Item>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="cad">
					<Tooltip side="left">
						<Orbit slot="data" size="15" />
						<span slot="tooltip">{$_('chart.show_cadence')}</span>
					</Tooltip>
				</ToggleGroup.Item>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="atemp">
					<Tooltip side="left">
						<Thermometer slot="data" size="15" />
						<span slot="tooltip">{$_('chart.show_temperature')}</span>
					</Tooltip>
				</ToggleGroup.Item>
				<ToggleGroup.Item class="p-0 w-5 h-5" value="power">
					<Tooltip side="left">
						<SquareActivity slot="data" size="15" />
						<span slot="tooltip">{$_('chart.show_power')}</span>
					</Tooltip>
				</ToggleGroup.Item>
			</ToggleGroup.Root>
		</div>
	{/if}
</div>
