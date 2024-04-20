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
							text: 'Distance (km)'
						}
					},
					y: {
						type: 'linear',
						title: {
							display: true,
							text: 'Elevation (m)'
						}
					}
				},
				datasets: {
					line: {
						pointRadius: 0
					}
				},
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						position: 'right'
					},
					decimation: {
						enabled: true
					}
				}
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
					normalized: true
				};
				chart.options.scales.x['min'] = 0;
				chart.options.scales.x['max'] = file.statistics.distance.total;
			});
			chart.update();
		}
	}
</script>

<div class="h-full grow min-w-0 p-4">
	<canvas bind:this={canvas}> </canvas>
</div>
