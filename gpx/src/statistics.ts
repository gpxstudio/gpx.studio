import { TrackPoint } from './gpx';
import { Coordinates } from './types';

export class GPXGlobalStatistics {
    length: number;
    distance: {
        moving: number;
        total: number;
    };
    time: {
        start: Date | undefined;
        end: Date | undefined;
        moving: number;
        total: number;
    };
    speed: {
        moving: number;
        total: number;
    };
    elevation: {
        gain: number;
        loss: number;
    };
    bounds: {
        southWest: Coordinates;
        northEast: Coordinates;
    };
    atemp: {
        avg: number;
        count: number;
    };
    hr: {
        avg: number;
        count: number;
    };
    cad: {
        avg: number;
        count: number;
    };
    power: {
        avg: number;
        count: number;
    };
    extensions: Record<string, Record<string, number>>;

    constructor() {
        this.length = 0;
        this.distance = {
            moving: 0,
            total: 0,
        };
        this.time = {
            start: undefined,
            end: undefined,
            moving: 0,
            total: 0,
        };
        this.speed = {
            moving: 0,
            total: 0,
        };
        this.elevation = {
            gain: 0,
            loss: 0,
        };
        this.bounds = {
            southWest: {
                lat: 90,
                lon: 180,
            },
            northEast: {
                lat: -90,
                lon: -180,
            },
        };
        this.atemp = {
            avg: 0,
            count: 0,
        };
        this.hr = {
            avg: 0,
            count: 0,
        };
        this.cad = {
            avg: 0,
            count: 0,
        };
        this.power = {
            avg: 0,
            count: 0,
        };
        this.extensions = {};
    }

    mergeWith(other: GPXGlobalStatistics): void {
        this.length += other.length;

        this.distance.total += other.distance.total;
        this.distance.moving += other.distance.moving;

        this.time.start =
            this.time.start !== undefined && other.time.start !== undefined
                ? new Date(Math.min(this.time.start.getTime(), other.time.start.getTime()))
                : (this.time.start ?? other.time.start);
        this.time.end =
            this.time.end !== undefined && other.time.end !== undefined
                ? new Date(Math.max(this.time.end.getTime(), other.time.end.getTime()))
                : (this.time.end ?? other.time.end);

        this.time.total += other.time.total;
        this.time.moving += other.time.moving;

        this.speed.moving =
            this.time.moving > 0 ? this.distance.moving / (this.time.moving / 3600) : 0;
        this.speed.total = this.time.total > 0 ? this.distance.total / (this.time.total / 3600) : 0;

        this.elevation.gain += other.elevation.gain;
        this.elevation.loss += other.elevation.loss;

        this.bounds.southWest.lat = Math.min(this.bounds.southWest.lat, other.bounds.southWest.lat);
        this.bounds.southWest.lon = Math.min(this.bounds.southWest.lon, other.bounds.southWest.lon);
        this.bounds.northEast.lat = Math.max(this.bounds.northEast.lat, other.bounds.northEast.lat);
        this.bounds.northEast.lon = Math.max(this.bounds.northEast.lon, other.bounds.northEast.lon);

        this.atemp.avg =
            (this.atemp.count * this.atemp.avg + other.atemp.count * other.atemp.avg) /
            Math.max(1, this.atemp.count + other.atemp.count);
        this.atemp.count += other.atemp.count;
        this.hr.avg =
            (this.hr.count * this.hr.avg + other.hr.count * other.hr.avg) /
            Math.max(1, this.hr.count + other.hr.count);
        this.hr.count += other.hr.count;
        this.cad.avg =
            (this.cad.count * this.cad.avg + other.cad.count * other.cad.avg) /
            Math.max(1, this.cad.count + other.cad.count);
        this.cad.count += other.cad.count;
        this.power.avg =
            (this.power.count * this.power.avg + other.power.count * other.power.avg) /
            Math.max(1, this.power.count + other.power.count);
        this.power.count += other.power.count;

        Object.keys(other.extensions).forEach((extension) => {
            if (this.extensions[extension] === undefined) {
                this.extensions[extension] = {};
            }
            Object.keys(other.extensions[extension]).forEach((value) => {
                if (this.extensions[extension][value] === undefined) {
                    this.extensions[extension][value] = 0;
                }
                this.extensions[extension][value] += other.extensions[extension][value];
            });
        });
    }
}

export class TrackPointLocalStatistics {
    distance: {
        moving: number;
        total: number;
    };
    time: {
        moving: number;
        total: number;
    };
    speed: number;
    elevation: {
        gain: number;
        loss: number;
    };
    slope: {
        at: number;
        segment: number;
        length: number;
    };

    constructor() {
        this.distance = {
            moving: 0,
            total: 0,
        };
        this.time = {
            moving: 0,
            total: 0,
        };
        this.speed = 0;
        this.elevation = {
            gain: 0,
            loss: 0,
        };
        this.slope = {
            at: 0,
            segment: 0,
            length: 0,
        };
    }
}

export class GPXLocalStatistics {
    points: TrackPoint[];
    data: TrackPointLocalStatistics[];

    constructor() {
        this.points = [];
        this.data = [];
    }
}

export type TrackPointWithLocalStatistics = {
    trkpt: TrackPoint;
} & TrackPointLocalStatistics;

export class GPXStatistics {
    global: GPXGlobalStatistics;
    local: GPXLocalStatistics;

    constructor() {
        this.global = new GPXGlobalStatistics();
        this.local = new GPXLocalStatistics();
    }

    sliced(start: number, end: number): GPXGlobalStatistics {
        if (start < 0) {
            start = 0;
        } else if (start >= this.global.length) {
            return new GPXGlobalStatistics();
        }

        if (end < start) {
            return new GPXGlobalStatistics();
        } else if (end >= this.global.length) {
            end = this.global.length - 1;
        }

        if (start === 0 && end === this.global.length - 1) {
            return this.global;
        }

        let statistics = new GPXGlobalStatistics();

        statistics.length = end - start + 1;

        statistics.distance.total =
            this.local.data[end].distance.total - this.local.data[start].distance.total;
        statistics.distance.moving =
            this.local.data[end].distance.moving - this.local.data[start].distance.moving;

        statistics.time.start = this.local.points[start].time;
        statistics.time.end = this.local.points[end].time;

        statistics.time.total = this.local.data[end].time.total - this.local.data[start].time.total;
        statistics.time.moving =
            this.local.data[end].time.moving - this.local.data[start].time.moving;

        statistics.speed.moving =
            statistics.time.moving > 0
                ? statistics.distance.moving / (statistics.time.moving / 3600)
                : 0;
        statistics.speed.total =
            statistics.time.total > 0
                ? statistics.distance.total / (statistics.time.total / 3600)
                : 0;

        statistics.elevation.gain =
            this.local.data[end].elevation.gain - this.local.data[start].elevation.gain;
        statistics.elevation.loss =
            this.local.data[end].elevation.loss - this.local.data[start].elevation.loss;

        statistics.bounds.southWest.lat = this.global.bounds.southWest.lat;
        statistics.bounds.southWest.lon = this.global.bounds.southWest.lon;
        statistics.bounds.northEast.lat = this.global.bounds.northEast.lat;
        statistics.bounds.northEast.lon = this.global.bounds.northEast.lon;

        statistics.atemp = this.global.atemp;
        statistics.hr = this.global.hr;
        statistics.cad = this.global.cad;
        statistics.power = this.global.power;

        return statistics;
    }
}

export class GPXStatisticsGroup {
    private _statistics: GPXStatistics[];
    private _cumulative: GPXGlobalStatistics[];
    private _slice: [number, number] | null = null;
    global: GPXGlobalStatistics;

    constructor() {
        this._statistics = [];
        this._cumulative = [new GPXGlobalStatistics()];
        this.global = new GPXGlobalStatistics();
    }

    add(statistics: GPXStatistics | GPXStatisticsGroup): void {
        if (statistics instanceof GPXStatisticsGroup) {
            statistics._statistics.forEach((stats) => this._add(stats));
        } else {
            this._add(statistics);
        }
    }

    _add(statistics: GPXStatistics): void {
        this._statistics.push(statistics);
        const cumulative = new GPXGlobalStatistics();
        cumulative.mergeWith(this._cumulative[this._cumulative.length - 1]);
        cumulative.mergeWith(statistics.global);
        this._cumulative.push(cumulative);
        this.global.mergeWith(statistics.global);
    }

    sliced(start: number, end: number): GPXGlobalStatistics {
        let sliced = new GPXGlobalStatistics();
        for (let i = 0; i < this._statistics.length; i++) {
            const statistics = this._statistics[i];
            const cumulative = this._cumulative[i];
            if (start < cumulative.length + statistics.global.length && end >= cumulative.length) {
                const localStart = Math.max(0, start - cumulative.length);
                const localEnd = Math.min(statistics.global.length - 1, end - cumulative.length);
                sliced.mergeWith(statistics.sliced(localStart, localEnd));
            }
        }
        return sliced;
    }

    getTrackPoint(index: number): TrackPointWithLocalStatistics | undefined {
        if (this._slice !== null) {
            index += this._slice[0];
        }
        for (let i = 0; i < this._statistics.length; i++) {
            const statistics = this._statistics[i];
            const cumulative = this._cumulative[i];
            if (index < cumulative.length + statistics.global.length) {
                return this._getTrackPoint(cumulative, statistics, index - cumulative.length);
            }
        }
        return undefined;
    }

    _getTrackPoint(
        cumulative: GPXGlobalStatistics,
        statistics: GPXStatistics,
        index: number
    ): TrackPointWithLocalStatistics {
        const point = statistics.local.points[index];
        return {
            trkpt: point,
            distance: {
                moving: statistics.local.data[index].distance.moving + cumulative.distance.moving,
                total: statistics.local.data[index].distance.total + cumulative.distance.total,
            },
            time: {
                moving: statistics.local.data[index].time.moving + cumulative.time.moving,
                total: statistics.local.data[index].time.total + cumulative.time.total,
            },
            speed: statistics.local.data[index].speed,
            elevation: {
                gain: statistics.local.data[index].elevation.gain + cumulative.elevation.gain,
                loss: statistics.local.data[index].elevation.loss + cumulative.elevation.loss,
            },
            slope: {
                at: statistics.local.data[index].slope.at,
                segment: statistics.local.data[index].slope.segment,
                length: statistics.local.data[index].slope.length,
            },
        };
    }

    forEachTrackPoint(
        callback: (
            point: TrackPoint,
            distance: number,
            speed: number,
            slope: { at: number; segment: number; length: number },
            index: number
        ) => void
    ): void {
        for (let i = 0; i < this._statistics.length; i++) {
            const statistics = this._statistics[i];
            const cumulative = this._cumulative[i];
            statistics.local.points.forEach((point, index) =>
                callback(
                    point,
                    cumulative.distance.total + statistics.local.data[index].distance.total,
                    statistics.local.data[index].speed,
                    statistics.local.data[index].slope,
                    cumulative.length + index
                )
            );
        }
    }
}
