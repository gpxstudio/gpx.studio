import { ListItem, ListLevel } from '$lib/components/file-list/file-list';
import { GPXFile, GPXStatistics, type Track } from 'gpx';

export class GPXStatisticsTree {
    level: ListLevel;
    statistics: {
        [key: string]: GPXStatisticsTree | GPXStatistics;
    } = {};

    constructor(element: GPXFile | Track) {
        if (element instanceof GPXFile) {
            this.level = ListLevel.FILE;
            element.children.forEach((child, index) => {
                this.statistics[index] = new GPXStatisticsTree(child);
            });
        } else {
            this.level = ListLevel.TRACK;
            element.children.forEach((child, index) => {
                this.statistics[index] = child.getStatistics();
            });
        }
    }

    getStatisticsFor(item: ListItem): GPXStatistics {
        let statistics = [];
        let id = item.getIdAtLevel(this.level);
        if (id === undefined || id === 'waypoints') {
            Object.keys(this.statistics).forEach((key) => {
                if (this.statistics[key] instanceof GPXStatistics) {
                    statistics.push(this.statistics[key]);
                } else {
                    statistics.push(this.statistics[key].getStatisticsFor(item));
                }
            });
        } else {
            let child = this.statistics[id];
            if (child instanceof GPXStatistics) {
                statistics.push(child);
            } else if (child !== undefined) {
                statistics.push(child.getStatisticsFor(item));
            }
        }
        if (statistics.length === 0) {
            return new GPXStatistics();
        } else if (statistics.length === 1) {
            return statistics[0];
        } else {
            return statistics.reduce((acc, curr) => {
                acc.mergeWith(curr);
                return acc;
            }, new GPXStatistics());
        }
    }
}
export type GPXFileWithStatistics = { file: GPXFile; statistics: GPXStatisticsTree };
