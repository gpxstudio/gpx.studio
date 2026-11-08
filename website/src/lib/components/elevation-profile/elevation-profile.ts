import { i18n } from '$lib/i18n/i18n.svelte';
import { settings } from '$lib/state/settings';
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
} from '$lib/units/units';
import Chart, {
    Tooltip,
    type ActiveDataPoint,
    type ChartEvent,
    type ChartOptions,
    type ChartType,
    type Point,
    type ScriptableLineSegmentContext,
    type TooltipItem,
    type TooltipPositionerFunction,
} from 'chart.js/auto';
import { get, type Readable, type Writable } from 'svelte/store';
import type { Coordinates } from '$lib/geo/coordinates';
import {
    engine,
    EMPTY_SELECTION_STATISTICS,
    type SelectionPoint,
    type SelectionStatistics,
    type StatisticsMetric,
    type StatisticsRequest,
} from '$lib/engine';
import type { SlicedStatistics } from '$lib/state/selection-statistics';
import { mode } from 'mode-watcher';
import { categoryValue, intervalAt } from '$lib/engine/trackpoint-categories';
import { getHighwayColor, getSlopeColor, getSurfaceColor } from '$lib/data/colors';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

Chart.defaults.font.family =
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

declare module 'chart.js' {
    interface TooltipPositionerMap {
        trackpoint: TooltipPositionerFunction<ChartType>;
    }
}

/**
 * Like the default for the events of the chart. A trackpoint that is shown without one is given by
 * its position, as it can be between the points of the chart (see `activateTrackpoint`).
 */
Tooltip.positioners.trackpoint = function (items, position) {
    return 'native' in position
        ? Tooltip.positioners.average.call(this, items, position)
        : position;
};

/** `undefined` for a missing measure (NaN), so that Chart.js leaves a gap instead of a value. */
function optional(value: number, convert: (value: number) => number = (v) => v) {
    return Number.isNaN(value) ? undefined : convert(value);
}

/**
 * A point of the chart. The rest of the data of the trackpoint is only read when it is hovered
 * (see `SelectionStatistics.point`), and the categories of the fill from their intervals.
 */
interface ElevationProfilePoint {
    x: number;
    y: number;
    index: number;
}

/** The index of the point the closest to `x`, in points sorted by `x`. */
function nearestPointIndex(points: { x: number }[], x: number): number {
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (points[middle].x < x) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low > 0 && x - points[low - 1].x < points[low].x - x ? low - 1 : low;
}

export class ElevationProfile {
    private _chart: Chart | null = null;
    private _canvas: HTMLCanvasElement;
    private _overlay: HTMLCanvasElement;
    private _dragging = false;
    private _panning = false;

    private _statistics: Readable<SelectionStatistics>;
    /** The statistics that the chart shows, which the fills read for each of its segments. */
    private _data: SelectionStatistics = EMPTY_SELECTION_STATISTICS;
    /**
     * The hovered trackpoint, and its data once it is read from the engine (`undefined` if the
     * statistics changed in the meantime).
     */
    private _hovered: { index: number; loaded: boolean; point?: SelectionPoint } | null = null;
    private _loadingHovered = false;
    /** The last move over the chart, held until the data of its trackpoint is read. */
    private _heldMove: MouseEvent | null = null;
    private _slicedStatistics: Writable<SlicedStatistics | undefined>;
    private _hoveredPoint: Writable<Coordinates | null>;
    /** All the points of each dataset, including the ones that the chart decimated. */
    private _points: ElevationProfilePoint[][] = [];
    /** The trackpoint hovered somewhere else, that the tooltip shows instead of its elements. */
    private _shownTrackpoint: number | null = null;
    private _hoveredTrackpoint: Readable<number | null> | undefined;
    private _unsubscribeHoveredTrackpoint: (() => void) | undefined;
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
        overlay: HTMLCanvasElement,
        hoveredTrackpoint?: Readable<number | null>
    ) {
        this._statistics = statistics;
        this._slicedStatistics = slicedStatistics;
        this._hoveredPoint = hoveredPoint;
        this._additionalDatasets = additionalDatasets;
        this._elevationFill = elevationFill;
        this._canvas = canvas;
        this._overlay = overlay;
        this._hoveredTrackpoint = hoveredTrackpoint;
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
            this._unsubscribeHoveredTrackpoint = this._hoveredTrackpoint?.subscribe((index) => {
                this.showTrackpoint(index);
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
        const options: ChartOptions<'line'> = {
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
                    spanGaps: true,
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
                    position: 'trackpoint',
                    callbacks: {
                        title: () => {
                            return '';
                        },
                        label: (context: TooltipItem<'line'>) => {
                            const point = this.pointOf(context);
                            if (context.datasetIndex === 0) {
                                this._hoveredPoint.set(
                                    this._dragging ? null : this.coordinatesOf(point.index)
                                );
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
                            const context = contexts.filter(
                                (context) => context.datasetIndex === 0
                            );
                            if (context.length === 0) return;
                            const point = this.pointOf(context[0]);
                            // the rest of the data is there once it is read (see `hover`)
                            const hovered = this._hovered;
                            const details =
                                hovered?.index === point.index ? hovered.point : undefined;
                            const elevationFill = get(this._elevationFill);

                            const labels = [
                                `    ${i18n._('quantities.distance')}: ${getDistanceWithUnits(point.x, false)}`,
                            ];

                            if (!details) {
                                return labels;
                            }
                            if (details.slope !== undefined) {
                                let slope = `${details.slope.toFixed(1)} %`;
                                if (
                                    elevationFill === 'slope' &&
                                    details.slopeSegmentSlope !== undefined &&
                                    details.slopeSegmentDistance !== undefined
                                ) {
                                    slope += ` (${getDistanceWithUnits(details.slopeSegmentDistance)} @${details.slopeSegmentSlope.toFixed(1)} %)`;
                                }
                                labels.push(`    ${i18n._('quantities.slope')}: ${slope}`);
                            }
                            const surface = details.surface ?? 'unknown';
                            const highway = details.highway ?? 'unknown';
                            const sacScale = details.sacScale;
                            const mtbScale = details.mtbScale;

                            if (elevationFill === 'surface') {
                                labels.push(
                                    `    ${i18n._('quantities.surface')}: ${i18n._(`toolbar.routing.surface.${surface}`)}`
                                );
                            }

                            if (elevationFill === 'highway') {
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

                            if (details.time !== undefined) {
                                labels.push(
                                    `    ${i18n._('quantities.time')}: ${i18n.df.format(new Date(details.time))}`
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
                        onZoomStart: ({ event }: { event: any }) => {
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

        const datasets: string[] = ['speed', 'hr', 'cad', 'atemp', 'power'];
        datasets.forEach((id) => {
            options.scales![`y${id}`] = {
                type: 'linear',
                position: 'right',
                grid: {
                    display: false,
                },
                // the pace axis is reversed: set with the data, which the units change
                reverse: false,
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
                            this._hovered = null;
                            this._heldMove = null;
                            this._hoveredPoint.set(null);
                        }
                    },
                },
                {
                    // The tooltip only shows a trackpoint once all its data is read: a move to
                    // another one is held until then, and replayed (see `loadHovered`).
                    id: 'waitForTrackpoint',
                    events: ['mousemove'],
                    beforeEvent: (chart: Chart, args: { event: ChartEvent }) => {
                        const index = this.indexAt(args.event);
                        if (index === undefined) {
                            return;
                        }
                        const hovered = this._hovered;
                        if (hovered?.index === index && hovered.loaded) {
                            this._heldMove = null;
                            return;
                        }
                        this._heldMove = args.event.native as MouseEvent;
                        this.hover(index);
                        return false;
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
                        get(this._statistics)
                            .slice(start, end)
                            .then((global) => {
                                if (global) {
                                    this._slicedStatistics.set({ global, start, end });
                                }
                            });
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
        this._data = data;
        const shownTrackpoint = this._shownTrackpoint;
        // the indices of the trackpoints are the ones of other statistics
        this._hovered = null;
        const units = {
            distance: get(distanceUnits),
            velocity: get(velocityUnits),
            temperature: get(temperatureUnits),
        };

        const datasets: Array<Array<any>> = [[], [], [], [], [], []];
        const { global } = data;
        for (let index = 0; index < data.length; index++) {
            const x = getConvertedDistance(data.totalDistance[index], units.distance);
            datasets[0].push({
                x,
                y: getConvertedElevation(data.ele[index], units.distance),
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

        this._points = datasets;
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
        // a faster pace is a lower value, it goes up like a higher speed
        this._chart.options.scales!.yspeed!.reverse = units.velocity === 'pace';

        this.setVisibility();
        this.setFill();

        this._chart.update();

        if (shownTrackpoint !== null) {
            this.showTrackpoint(shownTrackpoint);
        }
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
        const includeSpeed = additionalDatasets.includes('speed');
        const includeHeartRate = additionalDatasets.includes('hr');
        const includeCadence = additionalDatasets.includes('cad');
        const includeTemperature = additionalDatasets.includes('atemp');
        const includePower = additionalDatasets.includes('power');
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
            const startIndex = slicedStatistics.start;
            const endIndex = slicedStatistics.end;

            // Draw selection rectangle
            const selectionContext = this._overlay.getContext('2d');
            if (selectionContext) {
                selectionContext.fillStyle = mode.current === 'dark' ? 'white' : 'black';
                selectionContext.globalAlpha = mode.current === 'dark' ? 0.2 : 0.1;
                selectionContext.clearRect(0, 0, this._overlay.width, this._overlay.height);

                const statistics = get(this._statistics);
                const startPixel = this._chart.scales.x.getPixelForValue(
                    getConvertedDistance(statistics.totalDistance[startIndex] ?? 0)
                );
                const endPixel = this._chart.scales.x.getPixelForValue(
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
            const selectionContext = this._overlay.getContext('2d');
            if (selectionContext) {
                selectionContext.clearRect(0, 0, this._overlay.width, this._overlay.height);
            }
        }
    }

    /** The point that a line of the tooltip is about. */
    private pointOf(context: TooltipItem<'line'>): ElevationProfilePoint {
        return this._shownTrackpoint === null
            ? (context.raw as ElevationProfilePoint)
            : this._points[context.datasetIndex][this._shownTrackpoint];
    }

    private coordinatesOf(index: number): Coordinates {
        return { lat: this._data.lat[index], lng: this._data.lng[index] };
    }

    /** Shows a trackpoint in the tooltip like when hovering it, or nothing anymore with `null`. */
    private showTrackpoint(index: number | null) {
        const shown = this._shownTrackpoint;
        this._shownTrackpoint = index;
        if (index !== null) {
            this.hover(index);
            if (this._hovered?.loaded) {
                this.activateTrackpoint(index);
            }
        } else if (shown !== null) {
            this._hovered = null;
            this.setActiveElements([], { x: 0, y: 0 });
            this._hoveredPoint.set(null);
        }
    }

    /**
     * Opens the tooltip on a trackpoint, once its data is read. The chart can only activate the
     * points that it kept after decimating its data, which are different for each dataset and might
     * not include the trackpoint: it activates the nearest ones, within a pixel of it, and the
     * tooltip reads the values of the trackpoint (see `pointOf`).
     */
    private activateTrackpoint(index: number) {
        const point = this._points[0]?.[index];
        if (!this._chart || !point) {
            return;
        }
        const { x: xScale, y: yScale } = this._chart.scales;
        const elements: ActiveDataPoint[] = [];
        // when the chart is zoomed, the trackpoint can be outside of it
        if (xScale.min <= point.x && point.x <= xScale.max) {
            for (const { index: datasetIndex } of this._chart.getSortedVisibleDatasetMetas()) {
                if (this._points[datasetIndex]?.[index]?.y !== undefined) {
                    const data = this._chart.data.datasets[datasetIndex].data as { x: number }[];
                    elements.push({ datasetIndex, index: nearestPointIndex(data, point.x) });
                }
            }
        }
        if (elements.length === 0) {
            // no tooltip to tell the map about the point
            this._hoveredPoint.set(this.coordinatesOf(index));
        }
        this.setActiveElements(elements, {
            x: xScale.getPixelForValue(point.x),
            y: yScale.getPixelForValue(point.y),
        });
    }

    private setActiveElements(elements: ActiveDataPoint[], position: Point) {
        if (this._chart) {
            this._chart.tooltip?.setActiveElements(elements, position);
            this._chart.setActiveElements(elements);
            this._chart.render();
        }
    }

    /** The trackpoint that the tooltip shows for an event, `undefined` outside of the chart. */
    private indexAt(event: ChartEvent): number | undefined {
        const elements = this._chart?.getElementsAtEventForMode(
            event as unknown as Event,
            'nearest',
            { axis: 'x', intersect: false },
            false
        );
        const element = elements?.find((element) => element.datasetIndex === 0);
        // the data of the chart can be decimated: its points are the ones of the elements
        const point = element && this._chart?.data.datasets[0].data[element.index];
        return (point as ElevationProfilePoint | undefined)?.index;
    }

    /**
     * Reads the data of the hovered trackpoint from the engine, for the tooltip. One trackpoint is
     * read at a time, the last one hovered.
     */
    hover(index: number) {
        if (this._hovered?.index === index) {
            return;
        }
        this._hovered = { index, loaded: false };
        this.loadHovered();
    }

    private async loadHovered() {
        if (this._loadingHovered) {
            return; // the one being read is followed by the last one hovered
        }
        this._loadingHovered = true;
        try {
            while (this._hovered && !this._hovered.loaded) {
                const hovered = this._hovered;
                const point = await this._data.point(hovered.index);
                if (this._hovered !== hovered) {
                    continue; // another trackpoint is hovered, or none
                }
                hovered.loaded = true;
                hovered.point = point;
                if (this._shownTrackpoint === hovered.index) {
                    this.activateTrackpoint(hovered.index);
                }
                // the move that was held can now show the tooltip
                const move = this._heldMove;
                this._heldMove = null;
                if (move) {
                    this._canvas.dispatchEvent(new MouseEvent(move.type, move));
                }
            }
        } finally {
            this._loadingHovered = false;
        }
    }

    /** The trackpoint that a segment of the chart starts at. */
    private static segmentStart(context: ScriptableLineSegmentContext & { p0: { raw: any } }) {
        return (context.p0.raw as ElevationProfilePoint).index;
    }

    slopeFillCallback = (context: ScriptableLineSegmentContext & { p0: { raw: any } }) => {
        const segments = this._data.slopeSegments;
        const index = ElevationProfile.segmentStart(context);
        const segment = segments ? intervalAt(segments.starts, index) : -1;
        return getSlopeColor(segment >= 0 ? segments!.slopes[segment] : NaN);
    };

    surfaceFillCallback = (context: ScriptableLineSegmentContext & { p0: { raw: any } }) => {
        const index = ElevationProfile.segmentStart(context);
        return getSurfaceColor(categoryValue(this._data.surface, index) ?? '');
    };

    highwayFillCallback = (context: ScriptableLineSegmentContext & { p0: { raw: any } }) => {
        const index = ElevationProfile.segmentStart(context);
        return getHighwayColor(
            categoryValue(this._data.highway, index) ?? '',
            categoryValue(this._data.sacScale, index),
            categoryValue(this._data.mtbScale, index)
        );
    };

    destroy() {
        this._request.release();
        this._unsubscribeHoveredTrackpoint?.();
        if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
    }
}
