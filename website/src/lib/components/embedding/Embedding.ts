export type EmbeddingOptions = {
    token: string;
    files: string[];
    basemap: string;
    elevation: {
        show: boolean;
        height: number,
        controls: boolean,
        fill: 'slope' | 'surface' | undefined,
        speed: boolean,
        hr: boolean,
        cad: boolean,
        temp: boolean,
        power: boolean,
    },
    distanceUnits: 'metric' | 'imperial',
    velocityUnits: 'speed' | 'pace',
    temperatureUnits: 'celsius' | 'fahrenheit',
};

export const defaultEmbeddingOptions = {
    token: '',
    files: [],
    basemap: 'mapboxOutdoors',
    elevation: {
        show: true,
        height: 170,
        controls: true,
        fill: undefined,
        speed: false,
        hr: false,
        cad: false,
        temp: false,
        power: false,
    },
    distanceUnits: 'metric',
    velocityUnits: 'speed',
    temperatureUnits: 'celsius',
};

export function getDefaultEmbeddingOptions(): EmbeddingOptions {
    return JSON.parse(JSON.stringify(defaultEmbeddingOptions));
}

export function getCleanedEmbeddingOptions(options: any, defaultOptions: any = defaultEmbeddingOptions): any {
    const cleanedOptions = JSON.parse(JSON.stringify(options));
    for (const key in cleanedOptions) {
        if (typeof cleanedOptions[key] === 'object' && cleanedOptions[key] !== null && !Array.isArray(cleanedOptions[key])) {
            cleanedOptions[key] = getCleanedEmbeddingOptions(cleanedOptions[key], defaultOptions[key]);
            if (Object.keys(cleanedOptions[key]).length === 0) {
                delete cleanedOptions[key];
            }
        } else if (JSON.stringify(cleanedOptions[key]) === JSON.stringify(defaultOptions[key])) {
            delete cleanedOptions[key];
        }
    }
    return cleanedOptions;
}

export const allowedEmbeddingBasemaps = [
    'mapboxOutdoors',
    'mapboxSatellite',
];