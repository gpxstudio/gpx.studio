import Dexie from 'dexie';

export class SharedDatabase extends Dexie {
    overpasstiles!: Dexie.Table<
        { query: string; x: number; y: number; time: number },
        [string, number, number]
    >;
    overpassdata!: Dexie.Table<
        { query: string; id: number; poi: GeoJSON.Feature },
        [string, number]
    >;

    constructor() {
        super('gpxstudio-shared', {
            cache: 'immutable',
        });
        this.version(1).stores({
            overpasstiles: '[query+x+y],[x+y]',
            overpassdata: '[query+id]',
        });
    }
}

export const sharedDb = new SharedDatabase();
