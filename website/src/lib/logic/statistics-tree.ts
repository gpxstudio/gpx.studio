import { ListItem, ListLevel } from '$lib/components/file-list/file-list';
import { GPXFile, GPXStatistics, GPXStatisticsGroup, type Track } from 'gpx';
import maplibregl from 'maplibre-gl';

export class GPXStatisticsTree {
    level: ListLevel;
    statistics: {
        [key: string]: GPXStatisticsTree | GPXStatistics;
    } = {};
    wptBounds: maplibregl.LngLatBounds;

    constructor(element: GPXFile | Track) {
        this.wptBounds = new maplibregl.LngLatBounds();
        if (element instanceof GPXFile) {
            this.level = ListLevel.FILE;
            element.children.forEach((child, index) => {
                this.statistics[index] = new GPXStatisticsTree(child);
            });
            element.wpt.forEach((wpt) => {
                this.wptBounds.extend(wpt.getCoordinates());
            });
        } else {
            this.level = ListLevel.TRACK;
            element.children.forEach((child, index) => {
                this.statistics[index] = child.getStatistics();
            });
        }
    }

    getStatisticsFor(item: ListItem): GPXStatisticsGroup {
        let statistics = new GPXStatisticsGroup();
        let id = item.getIdAtLevel(this.level);
        if (id === undefined || id === 'waypoints') {
            Object.keys(this.statistics).forEach((key) => {
                if (this.statistics[key] instanceof GPXStatistics) {
                    statistics.add(this.statistics[key]);
                } else {
                    statistics.add(this.statistics[key].getStatisticsFor(item));
                }
            });
        } else {
            let child = this.statistics[id];
            if (child instanceof GPXStatistics) {
                statistics.add(child);
            } else if (child !== undefined) {
                statistics.add(child.getStatisticsFor(item));
            }
        }
        return statistics;
    }

    intersectsBBox(bounds: maplibregl.LngLatBounds): boolean {
        for (let key in this.statistics) {
            const stats = this.statistics[key];
            if (stats instanceof GPXStatistics) {
                const bbox = new maplibregl.LngLatBounds(
                    stats.global.bounds.southWest,
                    stats.global.bounds.northEast
                );
                if (!bbox.isEmpty() && bbox.intersects(bounds)) {
                    return true;
                }
            } else if (stats.intersectsBBox(bounds)) {
                return true;
            }
        }
        return false;
    }

    intersectsWaypointBBox(bounds: maplibregl.LngLatBounds): boolean {
        return !this.wptBounds.isEmpty() && this.wptBounds.intersects(bounds);
    }
}
export type GPXFileWithStatistics = { file: GPXFile; statistics: GPXStatisticsTree };
