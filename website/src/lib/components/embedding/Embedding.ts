import { PUBLIC_MAPBOX_TOKEN } from '$env/static/public';
import { basemaps } from '$lib/assets/layers';

export type EmbeddingOptions = {
	token: string;
	files: string[];
	basemap: string;
	elevation: {
		show: boolean;
		height: number;
		controls: boolean;
		fill: 'slope' | 'surface' | undefined;
		speed: boolean;
		hr: boolean;
		cad: boolean;
		temp: boolean;
		power: boolean;
	};
	distanceMarkers: boolean;
	directionMarkers: boolean;
	distanceUnits: 'metric' | 'imperial' | 'nautical';
	velocityUnits: 'speed' | 'pace';
	temperatureUnits: 'celsius' | 'fahrenheit';
	theme: 'system' | 'light' | 'dark';
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
		power: false
	},
	distanceMarkers: false,
	directionMarkers: false,
	distanceUnits: 'metric',
	velocityUnits: 'speed',
	temperatureUnits: 'celsius',
	theme: 'system'
};

export function getDefaultEmbeddingOptions(): EmbeddingOptions {
	return JSON.parse(JSON.stringify(defaultEmbeddingOptions));
}

export function getMergedEmbeddingOptions(
	options: any,
	defaultOptions: any = defaultEmbeddingOptions
): EmbeddingOptions {
	const mergedOptions = JSON.parse(JSON.stringify(defaultOptions));
	for (const key in options) {
		if (typeof options[key] === 'object' && options[key] !== null && !Array.isArray(options[key])) {
			mergedOptions[key] = getMergedEmbeddingOptions(options[key], defaultOptions[key]);
		} else {
			mergedOptions[key] = options[key];
		}
	}
	return mergedOptions;
}

export function getCleanedEmbeddingOptions(
	options: any,
	defaultOptions: any = defaultEmbeddingOptions
): any {
	const cleanedOptions = JSON.parse(JSON.stringify(options));
	for (const key in cleanedOptions) {
		if (
			typeof cleanedOptions[key] === 'object' &&
			cleanedOptions[key] !== null &&
			!Array.isArray(cleanedOptions[key])
		) {
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

export const allowedEmbeddingBasemaps = Object.keys(basemaps).filter(
	(basemap) => !['ordnanceSurvey'].includes(basemap)
);

export function getURLForGoogleDriveFile(fileId: string): string {
	return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=AIzaSyA2ZadQob_hXiT2VaYIkAyafPvz_4ZMssk`;
}

export function convertOldEmbeddingOptions(options: URLSearchParams): any {
	let newOptions: any = {
		token: PUBLIC_MAPBOX_TOKEN,
		files: []
	};
	if (options.has('state')) {
		let state = JSON.parse(options.get('state')!);
		if (state.ids) {
			newOptions.files.push(...state.ids.map(getURLForGoogleDriveFile));
		}
		if (state.urls) {
			newOptions.files.push(...state.urls);
		}
	}
	if (options.has('source')) {
		let basemap = options.get('source')!;
		if (basemap === 'satellite') {
			newOptions.basemap = 'mapboxSatellite';
		} else if (basemap === 'otm') {
			newOptions.basemap = 'openTopoMap';
		} else if (basemap === 'ohm') {
			newOptions.basemap = 'openHikingMap';
		}
	}
	if (options.has('imperial')) {
		newOptions.distanceUnits = 'imperial';
	}
	if (options.has('running')) {
		newOptions.velocityUnits = 'pace';
	}
	if (options.has('distance')) {
		newOptions.distanceMarkers = true;
	}
	if (options.has('direction')) {
		newOptions.directionMarkers = true;
	}
	if (options.has('slope')) {
		newOptions.elevation = {
			fill: 'slope'
		};
	}
	return newOptions;
}
