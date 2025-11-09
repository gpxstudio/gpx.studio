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
import Chart from 'chart.js/auto';
import mapboxgl from 'mapbox-gl';
import { get, type Readable, type Writable } from 'svelte/store';
import { map } from '$lib/components/map/map';
import type { GPXStatistics } from 'gpx';
import { mode } from 'mode-watcher';
import { getHighwayColor, getSlopeColor, getSurfaceColor } from '$lib/assets/colors';

const { distanceUnits, velocityUnits, temperatureUnits } = settings;

Chart.defaults.font.family =
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'; // Tailwind CSS font

export class ElevationProfile {
    private _chart: Chart | null = null;
    private _canvas: HTMLCanvasElement;
    private _overlay: HTMLCanvasElement;
    private _marker: mapboxgl.Marker | null = null;
    private _dragging = false;
    private _panning = false;

    private _gpxStatistics: Readable<GPXStatistics>;
    private _slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined>;
    private _additionalDatasets: Readable<string[]>;
    private _elevationFill: Readable<'slope' | 'surface' | 'highway' | undefined>;

    constructor(
        gpxStatistics: Readable<GPXStatistics>,
        slicedGPXStatistics: Writable<[GPXStatistics, number, number] | undefined>,
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
        this._marker = new mapboxgl.Marker({
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
                        maxRotation: 0,
                    },
                },
                y: {
                    type: 'linear',
                    ticks: {
                        callback: function (value: number) {
                            return getElevationWithUnits(value, false);
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
                        label: (context: Chart.TooltipContext) => {
                            let point = context.raw;
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
                        afterBody: (contexts: Chart.TooltipContext[]) => {
                            let context = contexts.filter((context) => context.datasetIndex === 0);
                            if (context.length === 0) return;
                            let point = context[0].raw;
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
                            if (
                                event.deltaY < 0 &&
                                Math.abs(
                                    this._chart.getInitialScaleBounds().x.max /
                                        this._chart.options.plugins.zoom.limits.x.minRange -
                                        this._chart.getZoomLevel()
                                ) < 0.01
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
            stacked: false,
            onResize: () => {
                this.updateOverlay();
            },
        };

        let datasets: string[] = ['speed', 'hr', 'cad', 'atemp', 'power'];
        datasets.forEach((id) => {
            options.scales[`y${id}`] = {
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
                    afterEvent: (chart: Chart, args: { event: Chart.ChartEvent }) => {
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
        const getIndex = (evt) => {
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
                    return get(this._gpxStatistics).local.points.length - 1;
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
        };

        let dragStarted = false;
        const onMouseDown = (evt) => {
            if (evt.shiftKey) {
                // Panning interaction
                return;
            }
            dragStarted = true;
            this._canvas.style.cursor = 'col-resize';
            startIndex = getIndex(evt);
        };
        const onMouseMove = (evt) => {
            if (dragStarted) {
                this._dragging = true;
                endIndex = getIndex(evt);
                if (endIndex !== undefined) {
                    if (startIndex === undefined) {
                        startIndex = endIndex;
                    } else if (startIndex !== endIndex) {
                        this._slicedGPXStatistics.set([
                            get(this._gpxStatistics).slice(
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
        const onMouseUp = (evt) => {
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
        this._chart.data.datasets[0] = {
            label: i18n._('quantities.elevation'),
            data: data.local.points.map((point, index) => {
                return {
                    x: getConvertedDistance(data.local.distance.total[index]),
                    y: point.ele ? getConvertedElevation(point.ele) : 0,
                    time: point.time,
                    slope: {
                        at: data.local.slope.at[index],
                        segment: data.local.slope.segment[index],
                        length: data.local.slope.length[index],
                    },
                    extensions: point.getExtensions(),
                    coordinates: point.getCoordinates(),
                    index: index,
                };
            }),
            normalized: true,
            fill: 'start',
            order: 1,
            segment: {},
        };
        this._chart.data.datasets[1] = {
            data: data.local.points.map((point, index) => {
                return {
                    x: getConvertedDistance(data.local.distance.total[index]),
                    y: getConvertedVelocity(data.local.speed[index]),
                    index: index,
                };
            }),
            normalized: true,
            yAxisID: 'yspeed',
        };
        this._chart.data.datasets[2] = {
            data: data.local.points.map((point, index) => {
                return {
                    x: getConvertedDistance(data.local.distance.total[index]),
                    y: point.getHeartRate(),
                    index: index,
                };
            }),
            normalized: true,
            yAxisID: 'yhr',
        };
        this._chart.data.datasets[3] = {
            data: data.local.points.map((point, index) => {
                return {
                    x: getConvertedDistance(data.local.distance.total[index]),
                    y: point.getCadence(),
                    index: index,
                };
            }),
            normalized: true,
            yAxisID: 'ycad',
        };
        this._chart.data.datasets[4] = {
            data: data.local.points.map((point, index) => {
                return {
                    x: getConvertedDistance(data.local.distance.total[index]),
                    y: getConvertedTemperature(point.getTemperature()),
                    index: index,
                };
            }),
            normalized: true,
            yAxisID: 'yatemp',
        };
        this._chart.data.datasets[5] = {
            data: data.local.points.map((point, index) => {
                return {
                    x: getConvertedDistance(data.local.distance.total[index]),
                    y: point.getPower(),
                    index: index,
                };
            }),
            normalized: true,
            yAxisID: 'ypower',
        };
        this._chart.options.scales.x['min'] = 0;
        this._chart.options.scales.x['max'] = getConvertedDistance(data.global.distance.total);

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
        if (elevationFill === 'slope') {
            this._chart.data.datasets[0]['segment'] = {
                backgroundColor: this.slopeFillCallback,
            };
        } else if (elevationFill === 'surface') {
            this._chart.data.datasets[0]['segment'] = {
                backgroundColor: this.surfaceFillCallback,
            };
        } else if (elevationFill === 'highway') {
            this._chart.data.datasets[0]['segment'] = {
                backgroundColor: this.highwayFillCallback,
            };
        } else {
            this._chart.data.datasets[0]['segment'] = {};
        }
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
                    getConvertedDistance(gpxStatistics.local.distance.total[startIndex])
                );
                let endPixel = this._chart.scales.x.getPixelForValue(
                    getConvertedDistance(gpxStatistics.local.distance.total[endIndex])
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

    slopeFillCallback(context) {
        return getSlopeColor(context.p0.raw.slope.segment);
    }

    surfaceFillCallback(context) {
        return getSurfaceColor(context.p0.raw.extensions.surface);
    }

    highwayFillCallback(context) {
        return getHighwayColor(
            context.p0.raw.extensions.highway,
            context.p0.raw.extensions.sac_scale,
            context.p0.raw.extensions.mtb_scale
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
