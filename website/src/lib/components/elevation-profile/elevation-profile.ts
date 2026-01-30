import { i18n } from '$lib/i18n.svelte';
import { settings } from '$lib/logic/settings';
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
    getVelocityWithUnits,
} from '$lib/units';
import Chart, {
    type ChartEvent,
    type ChartOptions,
    type ScriptableLineSegmentContext,
    type TooltipItem,
} from 'chart.js/auto';
import maplibregl from 'maplibre-gl';
import { get, type Readable, type Writable } from 'svelte/store';
import { map } from '$lib/components/map/map';
import type { GPXGlobalStatistics, GPXStatisticsGroup } from 'gpx';
import { mode } from 'mode-watcher';
import { getHighwayColor, getSlopeColor, getSurfaceColor } from '$lib/assets/colors';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

Chart.defaults.font.family =
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

interface ElevationProfilePoint {
    x: number;
    y: number;
    time?: Date;
    slope: {
        at: number;
        segment: number;
        length: number;
    };
    extensions: Record<string, any>;
    coordinates: [number, number];
    index: number;
}

export class ElevationProfile {
    private _chart: Chart | null = null;
    private _canvas: HTMLCanvasElement;
    private _overlay: HTMLCanvasElement;
    private _marker: maplibregl.Marker | null = null;
    private _dragging = false;
    private _panning = false;

    private _gpxStatistics: Readable<GPXStatisticsGroup>;
    private _slicedGPXStatistics: Writable<[GPXGlobalStatistics, number, number] | undefined>;
    private _additionalDatasets: Readable<string[]>;
    private _elevationFill: Readable<'slope' | 'surface' | 'highway' | undefined>;

    constructor(
        gpxStatistics: Readable<GPXStatisticsGroup>,
        slicedGPXStatistics: Writable<[GPXGlobalStatistics, number, number] | undefined>,
        additionalDatasets: Readable<string[]>,
        elevationFill: Readable<'slope' | 'surface' | 'highway' | undefined>,
        canvas: HTMLCanvasElement,
        overlay: HTMLCanvasElement
    ) {
        this._gpxStatistics = gpxStatistics;
        this._slicedGPXStatistics = slicedGPXStatistics;
        this._additionalDatasets = additionalDatasets;
        this._elevationFill = elevationFill;
        this._canvas = canvas;
        this._overlay = overlay;

        let element = document.createElement('div');
        element.className = 'h-4 w-4 rounded-full bg-cyan-500 border-2 border-white';
        this._marker = new maplibregl.Marker({
            element,
        });

        import('chartjs-plugin-zoom').then((module) => {
            Chart.register(module.default);
            this.initialize();

            this._gpxStatistics.subscribe(() => {
                this.updateData();
            });
            this._slicedGPXStatistics.subscribe(() => {
                this.updateOverlay();
            });
            distanceUnits.subscribe(() => {
                this.updateData();
            });
            velocityUnits.subscribe(() => {
                this.updateData();
            });
            temperatureUnits.subscribe(() => {
                this.updateData();
            });
            this._additionalDatasets.subscribe(() => {
                this.updateDataVisibility();
            });
            this._elevationFill.subscribe(() => {
                this.updateFill();
            });
        });
    }

    initialize() {
        let options: ChartOptions<'line'> = {
            animation: false,
            parsing: false,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    ticks: {
                        callback: function (value: number | string) {
                            return `${(value as number).toFixed(1).replace(/\.0+$/, '')} ${getDistanceUnits()}`;
                        },
                        align: 'inner',
                        maxRotation: 0,
                    },
                },
                y: {
                    type: 'linear',
                    ticks: {
                        callback: function (value: number | string) {
                            return getElevationWithUnits(value as number, false);
                        },
                    },
                },
            },
            datasets: {
                line: {
                    pointRadius: 0,
                    tension: 0.4,
                    borderWidth: 2,
                    cubicInterpolationMode: 'monotone',
                },
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: false,
                },
                decimation: {
                    enabled: true,
                },
                tooltip: {
                    enabled: () => !this._dragging && !this._panning,
                    callbacks: {
                        title: () => {
                            return '';
                        },
                        label: (context: TooltipItem<'line'>) => {
                            let point = context.raw as ElevationProfilePoint;
                            if (context.datasetIndex === 0) {
                                const map_ = get(map);
                                if (map_ && this._marker) {
                                    if (this._dragging) {
                                        this._marker.remove();
                                    } else {
                                        this._marker.setLngLat(point.coordinates);
                                        this._marker.addTo(map_);
                                    }
                                }
                                return `${i18n._('quantities.elevation')}: ${getElevationWithUnits(point.y, false)}`;
                            } else if (context.datasetIndex === 1) {
                                return `${get(velocityUnits) === 'speed' ? i18n._('quantities.speed') : i18n._('quantities.pace')}: ${getVelocityWithUnits(point.y, false)}`;
                            } else if (context.datasetIndex === 2) {
                                return `${i18n._('quantities.heartrate')}: ${getHeartRateWithUnits(point.y)}`;
                            } else if (context.datasetIndex === 3) {
                                return `${i18n._('quantities.cadence')}: ${getCadenceWithUnits(point.y)}`;
                            } else if (context.datasetIndex === 4) {
                                return `${i18n._('quantities.temperature')}: ${getTemperatureWithUnits(point.y, false)}`;
                            } else if (context.datasetIndex === 5) {
                                return `${i18n._('quantities.power')}: ${getPowerWithUnits(point.y)}`;
                            }
                        },
                        afterBody: (contexts: TooltipItem<'line'>[]) => {
                            let context = contexts.filter((context) => context.datasetIndex === 0);
                            if (context.length === 0) return;
                            let point = context[0].raw as ElevationProfilePoint;
                            let slope = {
                                at: point.slope.at.toFixed(1),
                                segment: point.slope.segment.toFixed(1),
                                length: getDistanceWithUnits(point.slope.length),
                            };
                            let surface = point.extensions.surface
                                ? point.extensions.surface
                                : 'unknown';
                            let highway = point.extensions.highway
                                ? point.extensions.highway
                                : 'unknown';
                            let sacScale = point.extensions.sac_scale;
                            let mtbScale = point.extensions.mtb_scale;

                            let labels = [
                                `    ${i18n._('quantities.distance')}: ${getDistanceWithUnits(point.x, false)}`,
                                `    ${i18n._('quantities.slope')}: ${slope.at} %${get(this._elevationFill) === 'slope' ? ` (${slope.length} @${slope.segment} %)` : ''}`,
                            ];

                            if (get(this._elevationFill) === 'surface') {
                                labels.push(
                                    `    ${i18n._('quantities.surface')}: ${i18n._(`toolbar.routing.surface.${surface}`)}`
                                );
                            }

                            if (get(this._elevationFill) === 'highway') {
                                labels.push(
                                    `    ${i18n._('quantities.highway')}: ${i18n._(`toolbar.routing.highway.${highway}`)}${
                                        sacScale
                                            ? ` (${i18n._(`toolbar.routing.sac_scale.${sacScale}`)})`
                                            : ''
                                    }`
                                );
                                if (mtbScale) {
                                    labels.push(
                                        `    ${i18n._('toolbar.routing.mtb_scale')}: ${mtbScale}`
                                    );
                                }
                            }

                            if (point.time) {
                                labels.push(
                                    `    ${i18n._('quantities.time')}: ${i18n.df.format(point.time)}`
                                );
                            }

                            return labels;
                        },
                    },
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'shift',
                        onPanStart: () => {
                            this._panning = true;
                            this._slicedGPXStatistics.set(undefined);
                            return true;
                        },
                        onPanComplete: () => {
                            this._panning = false;
                        },
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        mode: 'x',
                        onZoomStart: ({ chart, event }: { chart: Chart; event: any }) => {
                            if (!this._chart) {
                                return false;
                            }
                            const maxZoom = this._chart.getInitialScaleBounds()?.x?.max ?? 0;
                            if (
                                event.deltaY < 0 &&
                                Math.abs(maxZoom / this._chart.getZoomLevel()) < 0.01
                            ) {
                                // Disable wheel pan if zoomed in to the max, and zooming in
                                return false;
                            }

                            this._slicedGPXStatistics.set(undefined);
                        },
                    },
                    limits: {
                        x: {
                            min: 'original',
                            max: 'original',
                            minRange: 1,
                        },
                    },
                },
            },
            onResize: () => {
                this.updateOverlay();
            },
        };

        let datasets: string[] = ['speed', 'hr', 'cad', 'atemp', 'power'];
        datasets.forEach((id) => {
            options.scales![`y${id}`] = {
                type: 'linear',
                position: 'right',
                grid: {
                    display: false,
                },
                reverse: () => id === 'speed' && get(velocityUnits) === 'pace',
                display: false,
            };
        });

        this._chart = new Chart(this._canvas, {
            type: 'line',
            data: {
                datasets: [],
            },
            options,
            plugins: [
                {
                    id: 'toggleMarker',
                    events: ['mouseout'],
                    afterEvent: (chart: Chart, args: { event: ChartEvent }) => {
                        if (args.event.type === 'mouseout') {
                            const map_ = get(map);
                            if (map_ && this._marker) {
                                this._marker.remove();
                            }
                        }
                    },
                },
            ],
        });

        let startIndex = 0;
        let endIndex = 0;
        const getIndex = (evt: PointerEvent) => {
            if (!this._chart) {
                return undefined;
            }
            const points = this._chart.getElementsAtEventForMode(
                evt,
                'x',
                {
                    intersect: false,
                },
                true
            );

            if (points.length === 0) {
                const rect = this._canvas.getBoundingClientRect();
                if (evt.x - rect.left <= this._chart.chartArea.left) {
                    return 0;
                } else if (evt.x - rect.left >= this._chart.chartArea.right) {
                    return this._chart.data.datasets[0].data.length - 1;
                } else {
                    return undefined;
                }
            }

            const point = points.find((point) => (point.element as any).raw);
            if (point) {
                return (point.element as any).raw.index;
            } else {
                return points[0].index;
            }
        };

        let dragStarted = false;
        const onMouseDown = (evt: PointerEvent) => {
            if (evt.shiftKey) {
                // Panning interaction
                return;
            }
            dragStarted = true;
            this._canvas.style.cursor = 'col-resize';
            startIndex = getIndex(evt);
        };
        const onMouseMove = (evt: PointerEvent) => {
            if (dragStarted) {
                this._dragging = true;
                endIndex = getIndex(evt);
                if (endIndex !== undefined) {
                    if (startIndex === undefined) {
                        startIndex = endIndex;
                    } else if (startIndex !== endIndex) {
                        this._slicedGPXStatistics.set([
                            get(this._gpxStatistics).sliced(
                                Math.min(startIndex, endIndex),
                                Math.max(startIndex, endIndex)
                            ),
                            Math.min(startIndex, endIndex),
                            Math.max(startIndex, endIndex),
                        ]);
                    }
                }
            }
        };
        const onMouseUp = (evt: PointerEvent) => {
            dragStarted = false;
            this._dragging = false;
            this._canvas.style.cursor = '';
            endIndex = getIndex(evt);
            if (startIndex === endIndex) {
                this._slicedGPXStatistics.set(undefined);
            }
        };
        this._canvas.addEventListener('pointerdown', onMouseDown);
        this._canvas.addEventListener('pointermove', onMouseMove);
        this._canvas.addEventListener('pointerup', onMouseUp);
    }

    updateData() {
        if (!this._chart) {
            return;
        }
        const data = get(this._gpxStatistics);
        const units = {
            distance: get(distanceUnits),
            velocity: get(velocityUnits),
            temperature: get(temperatureUnits),
        };

        const datasets: Array<Array<any>> = [[], [], [], [], [], []];
        data.forEachTrackPoint((trkpt, distance, speed, slope, index) => {
            datasets[0].push({
                x: getConvertedDistance(distance, units.distance),
                y: trkpt.ele ? getConvertedElevation(trkpt.ele, units.distance) : 0,
                time: trkpt.time,
                slope: slope,
                extensions: trkpt.getExtensions(),
                coordinates: trkpt.getCoordinates(),
                index: index,
            });
            if (data.global.time.total > 0) {
                datasets[1].push({
                    x: getConvertedDistance(distance, units.distance),
                    y: getConvertedVelocity(speed, units.velocity, units.distance),
                    index: index,
                });
            }
            if (data.global.hr.count > 0) {
                datasets[2].push({
                    x: getConvertedDistance(distance, units.distance),
                    y: trkpt.getHeartRate(),
                    index: index,
                });
            }
            if (data.global.cad.count > 0) {
                datasets[3].push({
                    x: getConvertedDistance(distance, units.distance),
                    y: trkpt.getCadence(),
                    index: index,
                });
            }
            if (data.global.atemp.count > 0) {
                datasets[4].push({
                    x: getConvertedDistance(distance, units.distance),
                    y: getConvertedTemperature(trkpt.getTemperature(), units.temperature),
                    index: index,
                });
            }
            if (data.global.power.count > 0) {
                datasets[5].push({
                    x: getConvertedDistance(distance, units.distance),
                    y: trkpt.getPower(),
                    index: index,
                });
            }
        });

        this._chart.data.datasets[0] = {
            label: i18n._('quantities.elevation'),
            data: datasets[0],
            normalized: true,
            fill: 'start',
            order: 1,
            segment: {},
        };
        this._chart.data.datasets[1] = {
            data: datasets[1],
            normalized: true,
            yAxisID: 'yspeed',
        };
        this._chart.data.datasets[2] = {
            data: datasets[2],
            normalized: true,
            yAxisID: 'yhr',
        };
        this._chart.data.datasets[3] = {
            data: datasets[3],
            normalized: true,
            yAxisID: 'ycad',
        };
        this._chart.data.datasets[4] = {
            data: datasets[4],
            normalized: true,
            yAxisID: 'yatemp',
        };
        this._chart.data.datasets[5] = {
            data: datasets[5],
            normalized: true,
            yAxisID: 'ypower',
        };

        this._chart.options.scales!.x!['min'] = 0;
        this._chart.options.scales!.x!['max'] = getConvertedDistance(
            data.global.distance.total,
            units.distance
        );

        this.setVisibility();
        this.setFill();

        this._chart.update();
    }

    updateDataVisibility() {
        if (!this._chart) {
            return;
        }
        this.setVisibility();
        this._chart.update();
    }

    setVisibility() {
        if (!this._chart) {
            return;
        }

        const additionalDatasets = get(this._additionalDatasets);
        let includeSpeed = additionalDatasets.includes('speed');
        let includeHeartRate = additionalDatasets.includes('hr');
        let includeCadence = additionalDatasets.includes('cad');
        let includeTemperature = additionalDatasets.includes('atemp');
        let includePower = additionalDatasets.includes('power');
        if (this._chart.data.datasets.length == 6) {
            this._chart.data.datasets[1].hidden = !includeSpeed;
            this._chart.data.datasets[2].hidden = !includeHeartRate;
            this._chart.data.datasets[3].hidden = !includeCadence;
            this._chart.data.datasets[4].hidden = !includeTemperature;
            this._chart.data.datasets[5].hidden = !includePower;
        }
    }

    updateFill() {
        if (!this._chart) {
            return;
        }
        this.setFill();
        this._chart.update();
    }

    setFill() {
        if (!this._chart) {
            return;
        }
        const elevationFill = get(this._elevationFill);
        const dataset = this._chart.data.datasets[0];
        let segment: any = {};
        if (elevationFill === 'slope') {
            segment = {
                backgroundColor: this.slopeFillCallback,
            };
        } else if (elevationFill === 'surface') {
            segment = {
                backgroundColor: this.surfaceFillCallback,
            };
        } else if (elevationFill === 'highway') {
            segment = {
                backgroundColor: this.highwayFillCallback,
            };
        } else {
            segment = {};
        }
        Object.assign(dataset, { segment });
    }

    updateOverlay() {
        if (!this._chart) {
            return;
        }

        this._overlay.width = this._canvas.width / window.devicePixelRatio;
        this._overlay.height = this._canvas.height / window.devicePixelRatio;
        this._overlay.style.width = `${this._overlay.width}px`;
        this._overlay.style.height = `${this._overlay.height}px`;

        const slicedGPXStatistics = get(this._slicedGPXStatistics);
        if (slicedGPXStatistics) {
            let startIndex = slicedGPXStatistics[1];
            let endIndex = slicedGPXStatistics[2];

            // Draw selection rectangle
            let selectionContext = this._overlay.getContext('2d');
            if (selectionContext) {
                selectionContext.fillStyle = mode.current === 'dark' ? 'white' : 'black';
                selectionContext.globalAlpha = mode.current === 'dark' ? 0.2 : 0.1;
                selectionContext.clearRect(0, 0, this._overlay.width, this._overlay.height);

                const gpxStatistics = get(this._gpxStatistics);
                let startPixel = this._chart.scales.x.getPixelForValue(
                    getConvertedDistance(
                        gpxStatistics.getTrackPoint(startIndex)?.distance.total ?? 0
                    )
                );
                let endPixel = this._chart.scales.x.getPixelForValue(
                    getConvertedDistance(gpxStatistics.getTrackPoint(endIndex)?.distance.total ?? 0)
                );

                selectionContext.fillRect(
                    startPixel,
                    this._chart.chartArea.top,
                    endPixel - startPixel,
                    this._chart.chartArea.height
                );
            }
        } else if (this._overlay) {
            let selectionContext = this._overlay.getContext('2d');
            if (selectionContext) {
                selectionContext.clearRect(0, 0, this._overlay.width, this._overlay.height);
            }
        }
    }

    slopeFillCallback(context: ScriptableLineSegmentContext & { p0: { raw: any } }) {
        const point = context.p0.raw as ElevationProfilePoint;
        return getSlopeColor(point.slope.segment);
    }

    surfaceFillCallback(context: ScriptableLineSegmentContext & { p0: { raw: any } }) {
        const point = context.p0.raw as ElevationProfilePoint;
        return getSurfaceColor(point.extensions.surface);
    }

    highwayFillCallback(context: ScriptableLineSegmentContext & { p0: { raw: any } }) {
        const point = context.p0.raw as ElevationProfilePoint;
        return getHighwayColor(
            point.extensions.highway,
            point.extensions.sac_scale,
            point.extensions.mtb_scale
        );
    }

    destroy() {
        if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
        if (this._marker) {
            this._marker.remove();
        }
    }
}
