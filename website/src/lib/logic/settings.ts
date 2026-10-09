import {
    basemaps,
    defaultBasemap,
    defaultBasemapTree,
    defaultOpacities,
    defaultOverlays,
    defaultOverlayTree,
    defaultOverpassQueries,
    defaultOverpassTree,
    defaultTerrainSource,
    overpassTree,
    type CustomLayer,
    type LayerTreeType,
} from '$lib/assets/layers';
import { browser } from '$app/environment';
import type { DistanceUnits, TemperatureUnits, VelocityUnits } from '$lib/unit-conversions';
import { engine } from '$lib/engine';
import {
    getArrayValidator,
    getLayerTreeValidator,
    getLayerValidator,
    getValueValidator,
    Setting,
    SettingInitOnFirstRead,
    useSettingsStorage,
    type StoredSettings,
} from './setting';

export type { StoredSettings };

type AdditionalDataset = 'speed' | 'hr' | 'cad' | 'atemp' | 'power';
type ElevationFill = 'slope' | 'surface' | 'highway' | undefined;
type RoutingProfile =
    | 'bike'
    | 'racing_bike'
    | 'gravel_bike'
    | 'mountain_bike'
    | 'foot'
    | 'motorcycle'
    | 'water'
    | 'railway';
type TerrainSource = 'mapterhorn';
type StreetViewSource = 'mapillary' | 'google';

// The settings are kept by the engine, in the storage of the browser.
useSettingsStorage({
    save: (key, json) => engine.setSetting(key, json),
    remove: (key) => engine.deleteSetting(key),
});

export const settings = {
    distanceUnits: new Setting<DistanceUnits>(
        'distanceUnits',
        'metric',
        getValueValidator<DistanceUnits>(['metric', 'imperial', 'nautical'], 'metric')
    ),
    velocityUnits: new Setting<VelocityUnits>(
        'velocityUnits',
        'speed',
        getValueValidator<VelocityUnits>(['speed', 'pace'], 'speed')
    ),
    temperatureUnits: new Setting<TemperatureUnits>(
        'temperatureUnits',
        'celsius',
        getValueValidator<TemperatureUnits>(['celsius', 'fahrenheit'], 'celsius')
    ),
    elevationProfile: new Setting<boolean>('elevationProfile', true),
    additionalDatasets: new Setting<AdditionalDataset[]>(
        'additionalDatasets',
        [],
        getArrayValidator<AdditionalDataset>(['speed', 'hr', 'cad', 'atemp', 'power'])
    ),
    elevationFill: new Setting<ElevationFill>(
        'elevationFill',
        undefined,
        getValueValidator(['slope', 'surface', 'highway', undefined], undefined)
    ),
    treeFileView: new Setting<boolean>('fileView', false),
    minimizeRoutingMenu: new Setting('minimizeRoutingMenu', false),
    routing: new Setting('routing', true),
    routingProfile: new Setting<RoutingProfile>(
        'routingProfile',
        'bike',
        getValueValidator<RoutingProfile>(
            [
                'bike',
                'racing_bike',
                'gravel_bike',
                'mountain_bike',
                'foot',
                'motorcycle',
                'water',
                'railway',
            ],
            'bike'
        )
    ),
    privateRoads: new Setting('privateRoads', false),
    currentBasemap: new Setting(
        'currentBasemap',
        defaultBasemap,
        getLayerValidator(basemaps, defaultBasemap)
    ),
    previousBasemap: new Setting(
        'previousBasemap',
        defaultBasemap,
        getLayerValidator(basemaps, defaultBasemap)
    ),
    selectedBasemapTree: new Setting(
        'selectedBasemapTree',
        defaultBasemapTree,
        getLayerTreeValidator(defaultBasemapTree)
    ),
    currentOverlays: new SettingInitOnFirstRead(
        'currentOverlays',
        defaultOverlays,
        getLayerTreeValidator(defaultOverlayTree)
    ),
    previousOverlays: new Setting(
        'previousOverlays',
        defaultOverlays,
        getLayerTreeValidator(defaultOverlayTree)
    ),
    selectedOverlayTree: new Setting(
        'selectedOverlayTree',
        defaultOverlayTree,
        getLayerTreeValidator(defaultOverlayTree)
    ),
    currentOverpassQueries: new SettingInitOnFirstRead(
        'currentOverpassQueries',
        defaultOverpassQueries,
        getLayerTreeValidator(overpassTree)
    ),
    selectedOverpassTree: new Setting(
        'selectedOverpassTree',
        defaultOverpassTree,
        getLayerTreeValidator(overpassTree)
    ),
    opacities: new Setting('opacities', defaultOpacities),
    customLayers: new Setting<Record<string, CustomLayer>>('customLayers', {}),
    customBasemapOrder: new Setting<string[]>('customBasemapOrder', []),
    customOverlayOrder: new Setting<string[]>('customOverlayOrder', []),
    terrainSource: new Setting<TerrainSource>(
        'terrainSource',
        defaultTerrainSource,
        getValueValidator(['mapterhorn'], defaultTerrainSource)
    ),
    directionMarkers: new Setting('directionMarkers', false),
    distanceMarkers: new Setting('distanceMarkers', false),
    streetViewSource: new Setting<StreetViewSource>(
        'streetViewSource',
        'mapillary',
        getValueValidator<StreetViewSource>(['mapillary', 'google'], 'mapillary')
    ),
    defaultOpacity: new Setting('defaultOpacity', 0.7),
    defaultWidth: new Setting('defaultWidth', browser && window.innerWidth < 600 ? 8 : 5),
    bottomPanelSize: new Setting('bottomPanelSize', 170),
    rightPanelSize: new Setting('rightPanelSize', 240),
    /** Takes the saved values (see `Engine.openStorage`). */
    connect(stored: StoredSettings) {
        for (const key in settings) {
            const setting = (settings as any)[key];
            if (setting instanceof Setting || setting instanceof SettingInitOnFirstRead) {
                setting.connect(stored);
            }
        }
    },
    initialize() {
        for (const key in settings) {
            const setting = (settings as any)[key];
            if (setting instanceof SettingInitOnFirstRead) {
                setting.initialize();
            }
        }
    },
};
