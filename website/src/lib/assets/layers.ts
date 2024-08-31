import { TramFront, Utensils, ShoppingBasket, Droplet, ShowerHead, Fuel, CircleParking, Fence, FerrisWheel, Bed, Mountain, Pickaxe, Store, TrainFront, Bus, Ship, Croissant, House, Tent, Wrench, Binoculars } from 'lucide-static';
import { type Style } from 'mapbox-gl';
import ignFrTopo from './custom/ign-fr-topo.json';
import ignFrPlan from './custom/ign-fr-plan.json';
import ignFrSatellite from './custom/ign-fr-satellite.json';
import bikerouterGravel from './custom/bikerouter-gravel.json';

export const basemaps: { [key: string]: string | Style; } = {
    mapboxOutdoors: 'mapbox://styles/mapbox/outdoors-v12',
    mapboxSatellite: 'mapbox://styles/mapbox/satellite-streets-v12',
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
    swisstopoRaster: {
        version: 8,
        sources: {
            swisstopoRaster: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg'],
                tileSize: 128,
                maxzoom: 19,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopoRaster',
            type: 'raster',
            source: 'swisstopoRaster',
        }],
    },
    swisstopoVector: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json',
    swisstopoSatellite: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.imagerybasemap.vt/style.json',
    linz: 'https://basemaps.linz.govt.nz/v1/tiles/topographic/EPSG:3857/style/topographic.json?api=d01fbtg0ar23gctac5m0jgyy2ds',
    linzTopo: {
        version: 8,
        sources: {
            linzTopo: {
                type: 'raster',
                tiles: ['https://tiles-cdn.koordinates.com/services;key=39a8b989633a4bef98bc0e065380454a/tiles/v4/layer=50767/EPSG:3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.linz.govt.nz/" target="_blank">LINZ</a>'
            }
        },
        layers: [{
            id: 'linzTopo',
            type: 'raster',
            source: 'linzTopo',
        }],
    },
    ignBe: {
        version: 8,
        sources: {
            ignBe: {
                type: 'raster',
                tiles: ['https://cartoweb.wmts.ngi.be/1.0.0/topo/default/3857/{z}/{y}/{x}.png'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '© <a href="https://www.ngi.be/" target="_blank">IGN/NGI</a>'
            }
        },
        layers: [{
            id: 'ignBe',
            type: 'raster',
            source: 'ignBe',
        }],
    },
    ignFrPlan: ignFrPlan,
    ignFrTopo: ignFrTopo,
    ignFrScan25: {
        version: 8,
        sources: {
            ignFrScan25: {
                type: 'raster',
                tiles: ['https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&FORMAT=image/jpeg&STYLE=normal&apikey=ign_scan_ws'],
                tileSize: 256,
                maxzoom: 16,
                attribution: 'IGN-F/Géoportail'
            }
        },
        layers: [{
            id: 'ignFrScan25',
            type: 'raster',
            source: 'ignFrScan25',
        }],
    },
    ignFrSatellite: ignFrSatellite,
    ignEs: {
        version: 8,
        sources: {
            ignEs: {
                type: 'raster',
                tiles: ['https://www.ign.es/wmts/mapa-raster?layer=MTN&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}'],
                tileSize: 256,
                maxzoom: 20,
                attribution: 'IGN-F/Géoportail'
            }
        },
        layers: [{
            id: 'ignEs',
            type: 'raster',
            source: 'ignEs',
        }],
    },
    ordnanceSurvey: "https://api.os.uk/maps/vector/v1/vts/resources/styles?srs=3857&key=piCT8WysfuC3xLSUW7sGLfrAAJoYDvQz",
    norwayTopo: {
        version: 8,
        sources: {
            norwayTopo: {
                type: 'raster',
                tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'],
                tileSize: 256,
                maxzoom: 20,
                attribution: '&copy; <a href="https://www.geonorge.no/" target="_blank">Geonorge</a>'
            }
        },
        layers: [{
            id: 'norwayTopo',
            type: 'raster',
            source: 'norwayTopo',
        }],
    },
    swedenTopo: {
        version: 8,
        sources: {
            swedenTopo: {
                type: 'raster',
                tiles: ['https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/token/1d54dd14-a28c-38a9-b6f3-b4ebfcc3c204/1.0.0/topowebb/default/3857/{z}/{y}/{x}.png'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://www.lantmateriet.se" target="_blank">Lantmäteriet</a>'
            }
        },
        layers: [{
            id: 'swedenTopo',
            type: 'raster',
            source: 'swedenTopo',
        }],
    },
    finlandTopo: {
        version: 8,
        sources: {
            finlandTopo: {
                type: 'raster',
                tiles: ['https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts?layer=maastokartta&amp;style=default&tilematrixset=WGS84_Pseudo-Mercator&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}&api-key=30cb768c-c968-493c-ae24-2b0b974ebd29'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.maanmittauslaitos.fi/" target="_blank">Maanmittauslaitos</a>'
            }
        },
        layers: [{
            id: 'finlandTopo',
            type: 'raster',
            source: 'finlandTopo',
        }],
    },
    bgMountains: {
        version: 8,
        sources: {
            bgMountains: {
                type: 'raster',
                tiles: ['https://bgmtile.kade.si/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 19,
                attribution: '<a href="http://mountain.bajhui.org/trac/wiki/BGMountains%20%D0%BB%D0%B5%D0%B3%D0%B5%D0%BD%D0%B4%D0%B0" target="_blank">BGM Legend</a> / <a href="https://cart.uni-plovdiv.net/" target="_blank">CART Lab</a>, <a href="http://www.bgmountains.org/" target="_blank">BGM team</a>, © <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank">CC BY-SA 4.0</a>, <a href="http://bgmountains.org/en/maps/garmin-maps/category/9-bgmountains/" target="_blank">Garmin version</a>'
            }
        },
        layers: [{
            id: 'bgMountains',
            type: 'raster',
            source: 'bgMountains',
        }],
    },
    usgs: {
        version: 8,
        sources: {
            usgs: {
                type: 'raster',
                tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}?blankTile=false'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="usgs.gov" target="_blank">USGS</a>'
            }
        },
        layers: [{
            id: 'usgs',
            type: 'raster',
            source: 'usgs',
        }],
    },
};

export const overlays: { [key: string]: string | Style; } = {
    cyclOSMlite: {
        version: 8,
        sources: {
            cyclOSMlite: {
                type: 'raster',
                tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png', 'https://b.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png', 'https://c.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'cyclOSMlite',
            type: 'raster',
            source: 'cyclOSMlite',
        }],
    },
    bikerouterGravel: bikerouterGravel,
    swisstopoSlope: {
        version: 8,
        sources: {
            swisstopoSlope: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.hangneigung-ueber_30/default/current/3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>',
            },
        },
        layers: [{
            id: 'swisstopoSlope',
            type: 'raster',
            source: 'swisstopoSlope',
        }],
    },
    swisstopoHiking: {
        version: 8,
        sources: {
            swisstopoHiking: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-wanderwege/default/current/3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            },
        },
        layers: [{
            id: 'swisstopoHiking',
            type: 'raster',
            source: 'swisstopoHiking',
        }],
    },
    swisstopoHikingClosures: {
        version: 8,
        sources: {
            swisstopoHikingClosures: {
                type: 'raster',
                tiles: ['https://wms.geo.admin.ch/?version=1.3.0&service=WMS&request=GetMap&sld_version=1.1.0&layers=ch.astra.wanderland-sperrungen_umleitungen&format=image/png&STYLE=default&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&transparent=true'],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            },
        },
        layers: [{
            id: 'swisstopoHikingClosures',
            type: 'raster',
            source: 'swisstopoHikingClosures',
        }],
    },
    swisstopoCycling: {
        version: 8,
        sources: {
            swisstopoCycling: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.astra.veloland/default/current/3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopoCycling',
            type: 'raster',
            source: 'swisstopoCycling',
        }],
    },
    swisstopoCyclingClosures: {
        version: 8,
        sources: {
            swisstopoCyclingClosures: {
                type: 'raster',
                tiles: ['https://wms.geo.admin.ch/?version=1.3.0&service=WMS&request=GetMap&sld_version=1.1.0&layers=ch.astra.veloland-sperrungen_umleitungen&format=image/png&STYLE=default&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&transparent=true'],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopoCyclingClosures',
            type: 'raster',
            source: 'swisstopoCyclingClosures',
        }],
    },
    swisstopoMountainBike: {
        version: 8,
        sources: {
            swisstopoMountainBike: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.astra.mountainbikeland/default/current/3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopoMountainBike',
            type: 'raster',
            source: 'swisstopoMountainBike',
        }],
    },
    swisstopoMountainBikeClosures: {
        version: 8,
        sources: {
            swisstopoMountainBikeClosures: {
                type: 'raster',
                tiles: ['https://wms.geo.admin.ch/?version=1.3.0&service=WMS&request=GetMap&sld_version=1.1.0&layers=ch.astra.mountainbikeland-sperrungen_umleitungen&format=image/png&STYLE=default&bbox={bbox-epsg-3857}&width=256&height=256&crs=EPSG:3857&transparent=true'],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopoMountainBikeClosures',
            type: 'raster',
            source: 'swisstopoMountainBikeClosures',
        }],
    },
    swisstopoSkiTouring: {
        version: 8,
        sources: {
            swisstopoSkiTouring: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo-karto.skitouren/default/current/3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopoSkiTouring',
            type: 'raster',
            source: 'swisstopoSkiTouring',
        }],
    },
    ignFrCadastre: {
        version: 8,
        sources: {
            ignFrCadastre: {
                type: 'raster',
                tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&LAYER=CADASTRALPARCELS.PARCELS&FORMAT=image/png&STYLE=normal'],
                tileSize: 256,
                maxzoom: 20,
                attribution: 'IGN-F/Géoportail'
            }
        },
        layers: [{
            id: 'ignFrCadastre',
            type: 'raster',
            source: 'ignFrCadastre',
        }],
    },
    ignSlope: {
        version: 8,
        sources: {
            ignSlope: {
                type: 'raster',
                tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TileMatrixSet=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&Layer=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&FORMAT=image/png&Style=normal'],
                tileSize: 256,
                attribution: 'IGN-F/Géoportail'
            }
        },
        layers: [{
            id: 'ignSlope',
            type: 'raster',
            source: 'ignSlope',
        }],
    },
    ignSkiTouring: {
        version: 8,
        sources: {
            ignSkiTouring: {
                type: 'raster',
                tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TileMatrixSet=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&Layer=TRACES.RANDO.HIVERNALE&FORMAT=image/png&Style=normal'],
                tileSize: 256,
                maxzoom: 16,
                attribution: 'IGN-F/Géoportail'
            },
        },
        layers: [{
            id: 'ignSkiTouring',
            type: 'raster',
            source: 'ignSkiTouring',
        }],
    },
    waymarkedTrailsHiking: {
        version: 8,
        sources: {
            waymarkedTrailsHiking: {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
            }
        },
        layers: [{
            id: 'waymarkedTrailsHiking',
            type: 'raster',
            source: 'waymarkedTrailsHiking',
        }],
    },
    waymarkedTrailsCycling: {
        version: 8,
        sources: {
            waymarkedTrailsCycling: {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
            }
        },
        layers: [{
            id: 'waymarkedTrailsCycling',
            type: 'raster',
            source: 'waymarkedTrailsCycling',
        }],
    },
    waymarkedTrailsMTB: {
        version: 8,
        sources: {
            waymarkedTrailsMTB: {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
            }
        },
        layers: [{
            id: 'waymarkedTrailsMTB',
            type: 'raster',
            source: 'waymarkedTrailsMTB',
        }],
    },
    waymarkedTrailsSkating: {
        version: 8,
        sources: {
            waymarkedTrailsSkating: {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/skating/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
            }
        },
        layers: [{
            id: 'waymarkedTrailsSkating',
            type: 'raster',
            source: 'waymarkedTrailsSkating',
        }],
    },
    waymarkedTrailsHorseRiding: {
        version: 8,
        sources: {
            waymarkedTrailsHorseRiding: {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/riding/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
            }
        },
        layers: [{
            id: 'waymarkedTrailsHorseRiding',
            type: 'raster',
            source: 'waymarkedTrailsHorseRiding',
        }],
    },
    waymarkedTrailsWinter: {
        version: 8,
        sources: {
            waymarkedTrailsWinter: {
                type: 'raster',
                tiles: ['https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
            }
        },
        layers: [{
            id: 'waymarkedTrailsWinter',
            type: 'raster',
            source: 'waymarkedTrailsWinter',
        }],
    },
};

export const defaultOpacities: { [key: string]: number; } = {
    ignFrCadastre: 0.5,
    ignSlope: 0.4,
    swisstopoSlope: 0.4,
};

export type LayerTreeType = { [key: string]: LayerTreeType | boolean; };

// Hierarchy containing all basemaps
export const basemapTree: LayerTreeType = {
    basemaps: {
        world: {
            mapboxOutdoors: true,
            mapboxSatellite: true,
            openStreetMap: true,
            openTopoMap: true,
            openHikingMap: true,
            cyclOSM: true
        },
        countries: {
            belgium: {
                ignBe: true,
            },
            bulgaria: {
                bgMountains: true,
            },
            finland: {
                finlandTopo: true,
            },
            france: {
                ignFrPlan: true,
                ignFrTopo: true,
                ignFrScan25: true,
                ignFrSatellite: true,
            },
            new_zealand: {
                linz: true,
                linzTopo: true,
            },
            norway: {
                norwayTopo: true,
            },
            spain: {
                ignEs: true,
            },
            sweden: {
                swedenTopo: true,
            },
            switzerland: {
                swisstopoRaster: true,
                swisstopoVector: true,
                swisstopoSatellite: true,
            },
            united_kingdom: {
                ordnanceSurvey: true,
            },
            united_states: {
                usgs: true,
            }
        },
    },
}

// Hierarchy containing all overlays
export const overlayTree: LayerTreeType = {
    overlays: {
        world: {
            waymarked_trails: {
                waymarkedTrailsHiking: true,
                waymarkedTrailsCycling: true,
                waymarkedTrailsMTB: true,
                waymarkedTrailsSkating: true,
                waymarkedTrailsHorseRiding: true,
                waymarkedTrailsWinter: true,
            },
            cyclOSMlite: true,
            bikerouterGravel: true,
        },
        countries: {
            france: {
                ignFrCadastre: true,
                ignSlope: true,
                ignSkiTouring: true,
            },
            switzerland: {
                swisstopoSlope: true,
                swisstopoHiking: true,
                swisstopoHikingClosures: true,
                swisstopoCycling: true,
                swisstopoCyclingClosures: true,
                swisstopoMountainBike: true,
                swisstopoMountainBikeClosures: true,
                swisstopoSkiTouring: true,
            }
        },
    },
}

// Hierachy containing all Overpass layers
export const overpassTree: LayerTreeType = {
    points_of_interest: {
        food: {
            bakery: true,
            "food-store": true,
            "eat-and-drink": true,
        },
        amenities: {
            toilets: true,
            "water": true,
            shower: true,
            shelter: true,
            barrier: true
        },
        tourism: {
            attraction: true,
            viewpoint: true,
            hotel: true,
            campsite: true,
            hut: true,
            picnic: true,
            summit: true,
            pass: true,
            climbing: true,
        },
        bicycle: {
            "bicycle-parking": true,
            "bicycle-rental": true,
            "bicycle-shop": true
        },
        "public-transport": {
            "railway-station": true,
            "tram-stop": true,
            "bus-stop": true,
            ferry: true
        },
        motorized: {
            "fuel-station": true,
            parking: true,
            garage: true
        },
    },
};

// Default basemap used
export const defaultBasemap = 'mapboxOutdoors';

// Default overlays used (none)
export const defaultOverlays = {
    overlays: {
        world: {
            waymarked_trails: {
                waymarkedTrailsHiking: false,
                waymarkedTrailsCycling: false,
                waymarkedTrailsMTB: false,
                waymarkedTrailsSkating: false,
                waymarkedTrailsHorseRiding: false,
                waymarkedTrailsWinter: false,
            },
            cyclOSMlite: false,
            bikerouterGravel: false,
        },
        countries: {
            france: {
                ignFrCadastre: false,
                ignSlope: false,
                ignSkiTouring: false,
            },
            switzerland: {
                swisstopoSlope: false,
                swisstopoHiking: false,
                swisstopoHikingClosures: false,
                swisstopoCycling: false,
                swisstopoCyclingClosures: false,
                swisstopoMountainBike: false,
                swisstopoMountainBikeClosures: false,
                swisstopoSkiTouring: false,
            }
        },
    },
};

// Default Overpass queries used (none)
export const defaultOverpassQueries: LayerTreeType = {
    points_of_interest: {
        "food": {
            bakery: false,
            "food-store": false,
            "eat-and-drink": false,
        },
        amenities: {
            toilets: false,
            "water": false,
            shower: false,
            shelter: false,
            barrier: false
        },
        tourism: {
            attraction: false,
            viewpoint: false,
            hotel: false,
            campsite: false,
            hut: false,
            picnic: false,
            summit: false,
            pass: false,
            climbing: false
        },
        bicycle: {
            "bicycle-parking": false,
            "bicycle-rental": false,
            "bicycle-shop": false
        },
        "public-transport": {
            "railway-station": false,
            "tram-stop": false,
            "bus-stop": false,
            ferry: false
        },
        motorized: {
            "fuel-station": false,
            parking: false,
            garage: false
        },
    },
};

// Default basemaps shown in the layer menu
export const defaultBasemapTree: LayerTreeType = {
    basemaps: {
        world: {
            mapboxOutdoors: true,
            mapboxSatellite: true,
            openStreetMap: true,
            openTopoMap: true,
            openHikingMap: true,
            cyclOSM: true
        },
        countries: {
            belgium: {
                ignBe: false,
            },
            bulgaria: {
                bgMountains: false,
            },
            finland: {
                finlandTopo: false,
            },
            france: {
                ignFrPlan: false,
                ignFrTopo: false,
                ignFrScan25: false,
                ignFrSatellite: false,
            },
            new_zealand: {
                linz: false,
                linzTopo: false,
            },
            norway: {
                norwayTopo: false,
            },
            spain: {
                ignEs: false,
            },
            sweden: {
                swedenTopo: false,
            },
            switzerland: {
                swisstopoRaster: false,
                swisstopoVector: false,
                swisstopoSatellite: false,
            },
            united_kingdom: {
                ordnanceSurvey: false,
            },
            united_states: {
                usgs: false,
            }
        },
    }
};

// Default overlays shown in the layer menu
export const defaultOverlayTree: LayerTreeType = {
    overlays: {
        world: {
            waymarked_trails: {
                waymarkedTrailsHiking: true,
                waymarkedTrailsCycling: true,
                waymarkedTrailsMTB: true,
                waymarkedTrailsSkating: false,
                waymarkedTrailsHorseRiding: false,
                waymarkedTrailsWinter: false,
            },
            cyclOSMlite: false,
            bikerouterGravel: false,
        },
        countries: {
            france: {
                ignFrCadastre: false,
                ignSlope: false,
                ignSkiTouring: false,
            },
            switzerland: {
                swisstopoSlope: false,
                swisstopoHiking: false,
                swisstopoHikingClosures: false,
                swisstopoCycling: false,
                swisstopoCyclingClosures: false,
                swisstopoMountainBike: false,
                swisstopoMountainBikeClosures: false,
                swisstopoSkiTouring: false,
            }
        },
    }
}

// Default Overpass queries shown in the layer menu
export const defaultOverpassTree: LayerTreeType = {
    points_of_interest: {
        "food": {
            bakery: true,
            "food-store": true,
            "eat-and-drink": true,
        },
        amenities: {
            toilets: true,
            "water": true,
            shower: false,
            shelter: false,
            barrier: false
        },
        tourism: {
            attraction: false,
            viewpoint: false,
            hotel: true,
            campsite: true,
            hut: true,
            picnic: false,
            summit: true,
            pass: true,
            climbing: false
        },
        bicycle: {
            "bicycle-parking": false,
            "bicycle-rental": false,
            "bicycle-shop": true
        },
        "public-transport": {
            "railway-station": true,
            "tram-stop": true,
            "bus-stop": true,
            ferry: false
        },
        motorized: {
            "fuel-station": false,
            parking: false,
            garage: false
        },
    },
};

export type CustomLayer = {
    id: string,
    name: string,
    tileUrls: string[],
    maxZoom: number,
    layerType: 'basemap' | 'overlay',
    resourceType: 'raster' | 'vector',
    value: string | {},
};

type OverpassQueryData = {
    icon: {
        svg: string,
        color: string,
    },
    tags: Record<string, string | boolean | string[]> | Record<string, string | boolean | string[]>[],
    symbol?: string,
};

export const overpassQueryData: Record<string, OverpassQueryData> = {
    bakery: {
        icon: {
            svg: Croissant,
            color: "Coral",
        },
        tags: {
            shop: "bakery"
        },
        symbol: "Convenience Store"
    },
    "food-store": {
        icon: {
            svg: ShoppingBasket,
            color: "Coral",
        },
        tags: {
            shop: ["supermarket", "convenience"],
        },
        symbol: "Convenience Store"
    },
    "eat-and-drink": {
        icon: {
            svg: Utensils,
            color: "Coral",
        },
        tags: {
            amenity: ["restaurant", "fast_food", "cafe", "pub", "bar"]
        },
        symbol: "Restaurant"
    },
    toilets: {
        icon: {
            svg: Droplet,
            color: "DeepSkyBlue",
        },
        tags: {
            amenity: "toilets"
        },
        symbol: "Restroom"
    },
    water: {
        icon: {
            svg: Droplet,
            color: "DeepSkyBlue",
        },
        tags: [{
            amenity: ["drinking_water", "water_point"]
        }, {
            natural: "spring",
            drinking_water: "yes"
        }],
        symbol: "Drinking Water"
    },
    shower: {
        icon: {
            svg: ShowerHead,
            color: "DeepSkyBlue",
        },
        tags: {
            amenity: "shower"
        },
        symbol: "Shower"
    },
    shelter: {
        icon: {
            svg: Tent,
            color: "#000000",
        },
        tags: {
            amenity: "shelter"
        },
        symbol: "Shelter"
    },
    "fuel-station": {
        icon: {
            svg: Fuel,
            color: "#000000",
        },
        tags: {
            amenity: "fuel"
        },
        symbol: "Gas Station"
    },
    parking: {
        icon: {
            svg: CircleParking,
            color: "#000000",
        },
        tags: {
            amenity: "parking"
        },
        symbol: "Parking Area"
    },
    garage: {
        icon: {
            svg: Wrench,
            color: "#000000",
        },
        tags: {
            shop: ["car_repair", "motorcycle_repair"]
        },
        symbol: "Car Repair"
    },
    barrier: {
        icon: {
            svg: Fence,
            color: "#000000",
        },
        tags: {
            barrier: true
        }
    },
    attraction: {
        icon: {
            svg: FerrisWheel,
            color: "Green",
        },
        tags: {
            tourism: "attraction"
        }
    },
    viewpoint: {
        icon: {
            svg: Binoculars,
            color: "Green",
        },
        tags: {
            tourism: "viewpoint"
        },
        symbol: "Scenic Area"
    },
    hotel: {
        icon: {
            svg: Bed,
            color: "#e6c100",
        },
        tags: {
            tourism: ["hotel", "hostel", "guest_house", "motel"]
        },
        symbol: "Hotel"
    },
    campsite: {
        icon: {
            svg: Tent,
            color: "#e6c100",
        },
        tags: {
            tourism: "camp_site"
        },
        symbol: "Campground"
    },
    hut: {
        icon: {
            svg: House,
            color: "#e6c100",
        },
        tags: {
            tourism: ["alpine_hut", "wilderness_hut"]
        },
        symbol: "Lodge"
    },
    picnic: {
        icon: {
            svg: Utensils,
            color: "Green",
        },
        tags: {
            tourism: "picnic_site"
        },
        symbol: "Picnic Area"
    },
    summit: {
        icon: {
            svg: Mountain,
            color: "Green",
        },
        tags: {
            natural: "peak"
        },
        symbol: "Summit"
    },
    pass: {
        icon: {
            svg: Mountain,
            color: "Green",
        },
        tags: {
            mountain_pass: "yes"
        }
    },
    climbing: {
        icon: {
            svg: Pickaxe,
            color: "Green",
        },
        tags: {
            sport: "climbing"
        }
    },
    "bicycle-parking": {
        icon: {
            svg: CircleParking,
            color: "HotPink",
        },
        tags: {
            amenity: "bicycle_parking"
        },
        symbol: "Parking Area"
    },
    "bicycle-rental": {
        icon: {
            svg: Store,
            color: "HotPink",
        },
        tags: {
            amenity: "bicycle_rental"
        }
    },
    "bicycle-shop": {
        icon: {
            svg: Store,
            color: "HotPink",
        },
        tags: {
            shop: "bicycle"
        }
    },
    "railway-station": {
        icon: {
            svg: TrainFront,
            color: "DarkBlue",
        },
        tags: {
            railway: "station"
        },
        symbol: "Ground Transportation"
    },
    "tram-stop": {
        icon: {
            svg: TramFront,
            color: 'DarkBlue',
        },
        tags: {
            railway: "tram_stop"
        },
        symbol: "Ground Transportation"
    },
    "bus-stop": {
        icon: {
            svg: Bus,
            color: "DarkBlue",
        },
        tags: {
            "public_transport": ["stop_position", "platform"],
            bus: "yes"
        },
        symbol: "Ground Transportation"
    },
    ferry: {
        icon: {
            svg: Ship,
            color: "DarkBlue",
        },
        tags: {
            amenity: "ferry_terminal"
        },
        symbol: "Anchor"
    }
};