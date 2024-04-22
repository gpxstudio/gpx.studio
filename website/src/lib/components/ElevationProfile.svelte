<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { Separator } from '$lib/components/ui/separator';

	import Chart from 'chart.js/auto';

	import { files, fileOrder, selectedFiles } from '$lib/stores';

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
	import { GPXFiles } from 'gpx';
	import { surfaceColors } from '$lib/assets/surfaces';

	let canvas: HTMLCanvasElement;
	let chart: Chart;

	Chart.defaults.font.family =
		'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

	let elevationFill: string;
	let additionalDatasets: string[];

	let options = {
		animation: false,
		parsing: false,
		maintainAspectRatio: false,
		scales: {
			x: {
				type: 'linear',
				title: {
					display: true,
					text: 'Distance (km)',
					padding: 0
				}
			},
			y: {
				type: 'linear',
				title: {
					display: true,
					text: 'Elevation (m)',
					padding: 0
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
			}
		},
		stacked: false
	};

	let datasets = {
		speed: {
			id: 'speed',
			label: 'Speed',
			units: 'km/h'
		},
		hr: {
			id: 'hr',
			label: 'Heart Rate',
			units: 'bpm'
		},
		cad: {
			id: 'cad',
			label: 'Cadence',
			units: 'rpm'
		},
		atemp: {
			id: 'atemp',
			label: 'Temperature',
			units: '°C'
		},
		power: {
			id: 'power',
			label: 'Power',
			units: 'W'
		}
	};

	for (let [id, dataset] of Object.entries(datasets)) {
		options.scales[`y${id}`] = {
			type: 'linear',
			position: 'right',
			title: {
				display: true,
				text: dataset.label + ' (' + dataset.units + ')',
				padding: 0
			},
			grid: {
				display: false
			},
			display: false
		};
	}

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				datasets: []
			},
			options
		});
	});

	$: if (chart) {
		let gpxFiles = new GPXFiles(Array.from($selectedFiles));
		let order = $fileOrder.length == 0 ? $files : $fileOrder;
		gpxFiles.files.sort(function (a, b) {
			return order.indexOf(a) - order.indexOf(b);
		});

		let trackPointsAndStatistics = gpxFiles.getTrackPointsAndStatistics();
		chart.data.datasets[0] = {
			label: 'Elevation',
			data: trackPointsAndStatistics.points.map((point, index) => {
				return {
					x: trackPointsAndStatistics.statistics.distance[index],
					y: point.ele ? point.ele : 0,
					slope: trackPointsAndStatistics.statistics.slope[index],
					surface: point.getSurface()
				};
			}),
			normalized: true,
			fill: true,
			order: 1
		};
		chart.data.datasets[1] = {
			label: datasets.speed.label,
			data: trackPointsAndStatistics.points.map((point, index) => {
				return {
					x: trackPointsAndStatistics.statistics.distance[index],
					y: trackPointsAndStatistics.statistics.speed[index]
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.speed.id}`,
			hidden: true
		};
		chart.data.datasets[2] = {
			label: datasets.hr.label,
			data: trackPointsAndStatistics.points.map((point, index) => {
				return {
					x: trackPointsAndStatistics.statistics.distance[index],
					y: point.getHeartRate()
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.hr.id}`,
			hidden: true
		};
		chart.data.datasets[3] = {
			label: datasets.cad.label,
			data: trackPointsAndStatistics.points.map((point, index) => {
				return {
					x: trackPointsAndStatistics.statistics.distance[index],
					y: point.getCadence()
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.cad.id}`,
			hidden: true
		};
		chart.data.datasets[4] = {
			label: datasets.atemp.label,
			data: trackPointsAndStatistics.points.map((point, index) => {
				return {
					x: trackPointsAndStatistics.statistics.distance[index],
					y: point.getTemperature()
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.atemp.id}`,
			hidden: true
		};
		chart.data.datasets[5] = {
			label: datasets.power.label,
			data: trackPointsAndStatistics.points.map((point, index) => {
				return {
					x: trackPointsAndStatistics.statistics.distance[index],
					y: point.getPower()
				};
			}),
			normalized: true,
			yAxisID: `y${datasets.power.id}`,
			hidden: true
		};
		chart.options.scales.x['min'] = 0;
		chart.options.scales.x['max'] = gpxFiles.statistics.distance.total;
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

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});
</script>

<div class="h-full grow min-w-0 flex flex-row items-center">
	<div class="h-full grow min-w-0 py-4">
		<canvas bind:this={canvas}> </canvas>
	</div>
	<div class="h-fit flex flex-col m-2 border rounded">
		<ToggleGroup.Root class="flex-col gap-0" type="single" bind:value={elevationFill}>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="slope">
				<Tooltip side="left">
					<TriangleRight slot="data" size="16" />
					<span slot="tooltip">Show slope</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="surface">
				<Tooltip side="left">
					<BrickWall slot="data" size="16" />
					<span slot="tooltip">Show surface</span>
				</Tooltip>
			</ToggleGroup.Item>
		</ToggleGroup.Root>
		<Separator />
		<ToggleGroup.Root class="flex-col gap-0" type="multiple" bind:value={additionalDatasets}>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="speed">
				<Tooltip side="left">
					<Zap slot="data" size="16" />
					<span slot="tooltip">Show speed</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="hr">
				<Tooltip side="left">
					<HeartPulse slot="data" size="16" />
					<span slot="tooltip">Show heart rate</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="cad">
				<Tooltip side="left">
					<Orbit slot="data" size="16" />
					<span slot="tooltip">Show cadence</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="atemp">
				<Tooltip side="left">
					<Thermometer slot="data" size="16" />
					<span slot="tooltip">Show temperature</span>
				</Tooltip>
			</ToggleGroup.Item>
			<ToggleGroup.Item class="p-0 w-8 h-8" value="power">
				<Tooltip side="left">
					<SquareActivity slot="data" size="16" />
					<span slot="tooltip">Show power</span>
				</Tooltip>
			</ToggleGroup.Item>
		</ToggleGroup.Root>
	</div>
</div>
