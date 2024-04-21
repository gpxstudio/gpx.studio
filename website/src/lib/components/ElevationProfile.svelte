<script lang="ts">
	import Chart from 'chart.js/auto';

	import { selectedFiles } from '$lib/stores';

	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let chart: Chart;

	Chart.defaults.font.family =
		'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font
	onMount(() => {
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				datasets: []
			},
			options: {
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
					},
					y1: {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'Speed (km/h)',
							padding: 0
						},
						grid: {
							display: false
						}
					},
					y2: {
						type: 'linear',
						position: 'right',
						title: {
							display: true,
							text: 'Slope (%)',
							padding: 0
						},
						grid: {
							display: false
						}
					}
				},
				datasets: {
					line: {
						pointRadius: 0,
						tension: 0.4
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
			}
		});
	});

	$: {
		if ($selectedFiles.size == 1) {
			$selectedFiles.forEach((file) => {
				const trackPointsAndStatistics = file.getTrackPointsAndStatistics();
				chart.data.datasets[0] = {
					label: 'Elevation',
					data: trackPointsAndStatistics.points.map((point, index) => {
						return {
							x: trackPointsAndStatistics.statistics.distance[index],
							y: point.ele ? point.ele : 0
						};
					}),
					normalized: true,
					fill: true
				};
				chart.data.datasets[1] = {
					label: 'Speed',
					data: trackPointsAndStatistics.points.map((point, index) => {
						return {
							x: trackPointsAndStatistics.statistics.distance[index],
							y: trackPointsAndStatistics.statistics.speed[index]
						};
					}),
					normalized: true,
					yAxisID: 'y1'
				};
				chart.data.datasets[2] = {
					label: 'Slope',
					data: trackPointsAndStatistics.points.map((point, index) => {
						return {
							x: trackPointsAndStatistics.statistics.distance[index],
							y: trackPointsAndStatistics.statistics.slope[index]
						};
					}),
					normalized: true,
					yAxisID: 'y2'
				};
				chart.options.scales.x['min'] = 0;
				chart.options.scales.x['max'] = file.statistics.distance.total;
			});
			chart.update();
		}
	}
</script>

<div class="h-full grow min-w-0 py-4">
	<canvas bind:this={canvas}> </canvas>
</div>
