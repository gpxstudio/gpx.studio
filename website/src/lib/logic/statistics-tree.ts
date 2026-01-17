import { ListItem, ListLevel } from '$lib/components/file-list/file-list';
import { GPXFile, GPXStatistics, GPXStatisticsGroup, type Track } from 'gpx';

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
}
export type GPXFileWithStatistics = { file: GPXFile; statistics: GPXStatisticsTree };
