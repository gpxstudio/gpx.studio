import { type AnySourceData, type Style } from 'mapbox-gl';

export const basemaps: { [key: string]: string | Style; } = {
    mapboxOutdoors: 'mapbox://styles/mapbox/outdoors-v12',
    mapboxSatellite: 'mapbox://styles/mapbox/satellite-v9',
    openStreetMap: {
        version: 8,
        sources: {
            openStreetMap: {
                type: 'raster',
                tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: 'Map tiles by <a target="_top" rel="noopener" href="https://tile.openstreetmap.org/">OpenStreetMap tile servers</a>, under the <a target="_top" rel="noopener" href="https://operations.osmfoundation.org/policies/tiles/">tile usage policy</a>. Data by <a target="_top" rel="noopener" href="http://openstreetmap.org">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'openStreetMap',
            type: 'raster',
            source: 'openStreetMap',
        }],
    },
    openTopoMap: {
        version: 8,
        sources: {
            openTopoMap: {
                type: 'raster',
                tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://www.opentopomap.org" target="_blank">OpenTopoMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'openTopoMap',
            type: 'raster',
            source: 'openTopoMap',
        }],
    },
    openHikingMap: {
        version: 8,
        sources: {
            openHikingMap: {
                type: 'raster',
                tiles: ['https://maps.refuges.info/hiking/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://wiki.openstreetmap.org/wiki/Hiking/mri" target="_blank">sly</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'openHikingMap',
            type: 'raster',
            source: 'openHikingMap',
        }],
    },
    cyclOSM: {
        version: 8,
        sources: {
            cyclOSM: {
                type: 'raster',
                tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', 'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', 'https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'cyclOSM',
            type: 'raster',
            source: 'cyclOSM',
        }],
    },
    linz: 'https://basemaps.linz.govt.nz/v1/tiles/topographic/EPSG:3857/style/topographic.json?api=d01fbtg0ar23gctac5m0jgyy2ds'
};

export const overlays: { [key: string]: AnySourceData; } = {
    cyclOSMlite: {
        type: 'raster',
        tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png', 'https://b.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png', 'https://c.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
};