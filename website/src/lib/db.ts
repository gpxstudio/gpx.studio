import Dexie from 'dexie';
import type { GPXFile } from 'gpx';
import { enableMapSet, enablePatches, type Patch } from 'immer';

enableMapSet();
enablePatches();

export class Database extends Dexie {
    fileids!: Dexie.Table<string, string>;
    files!: Dexie.Table<GPXFile, string>;
    patches!: Dexie.Table<{ patch: Patch[]; inversePatch: Patch[]; index: number }, number>;
    settings!: Dexie.Table<any, string>;

    constructor(name: string = 'gpxstudio') {
        super(name, {
            cache: 'immutable',
        });
        this.version(1).stores({
            fileids: ',&fileid',
            files: '',
            patches: ',patch',
            settings: '',
        });
    }
}

export const db = new Database();

export function createProjectDatabase(projectId: string): Database {
    return new Database(`gpxstudio-${projectId}`);
}
