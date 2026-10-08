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
import { get, type Readable, type Writable } from 'svelte/store';
import type { Coordinates } from '$lib/geo';
import {
    engine,
    NO_TIME,
    type SelectionStatistics,
    type StatisticsMetric,
    type StatisticsRequest,
} from '$lib/engine';
import type { SlicedStatistics } from '$lib/logic/selection-statistics';
import { mode } from 'mode-watcher';
import { categoryValues } from '$lib/trackpoint-categories';
import { getHighwayColor, getSlopeColor, getSurfaceColor } from '$lib/assets/colors';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

Chart.defaults.font.family =
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

/** `undefined` for a missing measure (NaN), so that Chart.js leaves a gap instead of a value. */
function optional(value: number, convert: (value: number) => number = (v) => v) {
    return Number.isNaN(value) ? undefined : convert(value);
}

interface ElevationProfilePoint {
    x: number;
    y: number;
    time?: Date;
    slope: {
        at: number;
        segment: number;
        length: number;
    };
    surface?: string;
    highway?: string;
    sacScale?: string;
    mtbScale?: string;
    coordinates: Coordinates;
    index: number;
}

export class ElevationProfile {
    private _chart: Chart | null = null;
    private _canvas: HTMLCanvasElement;
    private _overlay: HTMLCanvasElement;
    private _dragging = false;
    private _panning = false;

    private _statistics: Readable<SelectionStatistics>;
    private _slicedStatistics: Writable<SlicedStatistics | undefined>;
    private _hoveredPoint: Writable<Coordinates | null>;
    private _additionalDatasets: Readable<string[]>;
    private _elevationFill: Readable<'slope' | 'surface' | 'highway' | undefined>;
    /** The statistics that are only read from the engine while the profile shows them. */
    private _request: StatisticsRequest;

    constructor(
        statistics: Readable<SelectionStatistics>,
        slicedStatistics: Writable<SlicedStatistics | undefined>,
        hoveredPoint: Writable<Coordinates | null>,
        additionalDatasets: Readable<string[]>,
        elevationFill: Readable<'slope' | 'surface' | 'highway' | undefined>,
        canvas: HTMLCanvasElement,
        overlay: HTMLCanvasElement
    ) {
        this._statistics = statistics;
        this._slicedStatistics = slicedStatistics;
        this._hoveredPoint = hoveredPoint;
        this._additionalDatasets = additionalDatasets;
        this._elevationFill = elevationFill;
        this._canvas = canvas;
        this._overlay = overlay;
        this._request = engine.requestStatistics();
        this.updateRequest();

        import('chartjs-plugin-zoom').then((module) => {
            Chart.register(module.default);
            this.initialize();

            this._statistics.subscribe(() => {
                this.updateData();
            });
            this._slicedStatistics.subscribe(() => {
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
                // requesting a missing metric updates the data, and then the visibility
                this.updateRequest();
                this.updateDataVisibility();
            });
            this._elevationFill.subscribe(() => {
                this.updateRequest();
                this.updateFill();
            });
        });
    }

    /** Asks the engine for what the profile currently shows, and nothing more. */
    updateRequest() {
        const metrics = new Set<StatisticsMetric>();
        for (const dataset of get(this._additionalDatasets)) {
            if (['speed', 'hr', 'cad', 'atemp', 'power'].includes(dataset)) {
                metrics.add(dataset as StatisticsMetric);
            }
        }
        const elevationFill = get(this._elevationFill);
        if (elevationFill === 'slope') {
            metrics.add('slopeSegment');
        } else if (elevationFill) {
            metrics.add(elevationFill);
        }
        this._request.set(metrics);
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
                                if (this._dragging) {
                                    this._hoveredPoint.set(null);
                                } else {
                                    this._hoveredPoint.set(point.coordinates);
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
                            let surface = point.surface ?? 'unknown';
                            let highway = point.highway ?? 'unknown';
                            let sacScale = point.sacScale;
                            let mtbScale = point.mtbScale;

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
                            this._slicedStatistics.set(undefined);
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

                            this._slicedStatistics.set(undefined);
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
                            this._hoveredPoint.set(null);
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
                        const start = Math.min(startIndex, endIndex);
                        const end = Math.max(startIndex, endIndex);
                        const global = get(this._statistics).slice(start, end);
                        if (global) {
                            this._slicedStatistics.set({ global, start, end });
                        }
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
                this._slicedStatistics.set(undefined);
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
        const data = get(this._statistics);
        const units = {
            distance: get(distanceUnits),
            velocity: get(velocityUnits),
            temperature: get(temperatureUnits),
        };

        const datasets: Array<Array<any>> = [[], [], [], [], [], []];
        const { global } = data;
        const surfaces = categoryValues(data.surface, data.length);
        const highways = categoryValues(data.highway, data.length);
        const sacScales = categoryValues(data.sacScale, data.length);
        const mtbScales = categoryValues(data.mtbScale, data.length);
        for (let index = 0; index < data.length; index++) {
            const x = getConvertedDistance(data.totalDistance[index], units.distance);
            const ele = data.ele[index];
            const timestamp = data.timestamps?.[index] ?? NO_TIME;
            datasets[0].push({
                x,
                y: getConvertedElevation(ele, units.distance),
                time: timestamp === NO_TIME ? undefined : new Date(Number(timestamp)),
                slope: {
                    at: data.slope[index],
                    segment: data.slopeSegmentSlope?.[index] ?? NaN,
                    length: data.slopeSegmentDistance?.[index] ?? NaN,
                },
                surface: surfaces[index],
                highway: highways[index],
                sacScale: sacScales[index],
                mtbScale: mtbScales[index],
                coordinates: { lat: data.lat[index], lng: data.lng[index] },
                index,
            });
            if (data.speed && (global.totalTime ?? 0) > 0) {
                datasets[1].push({
                    x,
                    y: optional(data.speed[index], (value) =>
                        getConvertedVelocity(value, units.velocity, units.distance)
                    ),
                    index,
                });
            }
            if (data.hr) {
                datasets[2].push({ x, y: optional(data.hr[index]), index });
            }
            if (data.cad) {
                datasets[3].push({ x, y: optional(data.cad[index]), index });
            }
            if (data.atemp) {
                datasets[4].push({
                    x,
                    y: optional(data.atemp[index], (value) =>
                        getConvertedTemperature(value, units.temperature)
                    ),
                    index,
                });
            }
            if (data.power) {
                datasets[5].push({ x, y: optional(data.power[index]), index });
            }
        }

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
            global.totalDistance,
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

        const slicedStatistics = get(this._slicedStatistics);
        if (slicedStatistics) {
            let startIndex = slicedStatistics.start;
            let endIndex = slicedStatistics.end;

            // Draw selection rectangle
            let selectionContext = this._overlay.getContext('2d');
            if (selectionContext) {
                selectionContext.fillStyle = mode.current === 'dark' ? 'white' : 'black';
                selectionContext.globalAlpha = mode.current === 'dark' ? 0.2 : 0.1;
                selectionContext.clearRect(0, 0, this._overlay.width, this._overlay.height);

                const statistics = get(this._statistics);
                let startPixel = this._chart.scales.x.getPixelForValue(
                    getConvertedDistance(statistics.totalDistance[startIndex] ?? 0)
                );
                let endPixel = this._chart.scales.x.getPixelForValue(
                    getConvertedDistance(statistics.totalDistance[endIndex] ?? 0)
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
        return getSurfaceColor(point.surface ?? '');
    }

    highwayFillCallback(context: ScriptableLineSegmentContext & { p0: { raw: any } }) {
        const point = context.p0.raw as ElevationProfilePoint;
        return getHighwayColor(point.highway ?? '', point.sacScale, point.mtbScale);
    }

    destroy() {
        this._request.release();
        if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
    }
}
