import { TramFront, Utensils, ShoppingBasket, Droplet, ShowerHead, Fuel, CircleParking, Fence, FerrisWheel, Bed, Mountain, Pickaxe, Store, TrainFront, Bus, Ship, Croissant, House, Tent, Wrench, Binoculars, Toilet } from 'lucide-static';
import { type StyleSpecification } from 'mapbox-gl';
import ignFrTopo from './custom/ign-fr-topo.json';
import ignFrPlan from './custom/ign-fr-plan.json';
import ignFrSatellite from './custom/ign-fr-satellite.json';
import bikerouterGravel from './custom/bikerouter-gravel.json';
import { LucideArrowDownZA, TabletSmartphone } from 'lucide-svelte';

import { env } from '$env/dynamic/public';

/** Caching tile proxy (map-tiles). Override with PUBLIC_TILES_URL for local docker (:4009). */
const TILES = (env.PUBLIC_TILES_URL ?? 'https://tiles.wanderstories.space').replace(/\/$/, '');

export const basemaps: { [key: string]: string | StyleSpecification; } = {
    /*wsOutdoors: {
        version: 8,
        sources: {
            wsOutdoors: {
                type: 'raster',
                tiles: [`${TILES}/mapbox/topo/{z}/{x}/{y}`],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank">Mapbox</a>'
            }
        },
        layers: [{
            id: 'wsOutdoors',
            type: 'raster',
            source: 'wsOutdoors',
        }],
    },*/
    wsOutdoors: 'mapbox://styles/luenwarneke/cjzdctwa31lsp1ctbxj8mlei5',
    mapboxOutdoors: 'mapbox://styles/mapbox/outdoors-v12',
    //mapboxSatellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    mapboxSatellite: {
        version: 8,
        sources: {
            mapboxSatellite: {
                type: 'raster',
                tiles: [`${TILES}/mapbox/satellite/{z}/{x}/{y}`],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank">Mapbox</a>'
            }
        },
        layers: [{
            id: 'mapboxSatellite',
            type: 'raster',
            source: 'mapboxSatellite',
        }],
    },
    openStreetMap: {
        version: 8,
        sources: {
            openStreetMap: {
                type: 'raster',
                tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 19,
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
                //tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
                tiles: ['https://opentopomap.wanderstories.space/{z}/{x}/{y}.png'],
                //tiles: [`${TILES}/opentopomap/{z}/{x}/{y}.png`],
                tileSize: 256,
                //maxzoom: 17,
                maxzoom: 16,
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
                maxzoom: 18,
                attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'cyclOSM',
            type: 'raster',
            source: 'cyclOSM',
        }],
    },
    openCycleMap: {
        version: 8,
        sources: {
            openCycleMap: {
                type: 'raster',
                tiles: ['https://tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=01a11fd78058448393f44810a68e989c'],
                tileSize: 256,
                maxzoom: 17,
                attribution: 'Maps: &copy; <a href="https://www.thunderforest.com" target="_blank">Thunderforest</a> | Data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
        },
        layers: [{
            id: 'openCycleMap',
            type: 'raster',
            source: 'openCycleMap',
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
    linzImagery: {
        version: 8,
        sources: {
            linzImagery: {
                type: 'raster',
                tiles: ['https://tiles-cdn.koordinates.com/services;key=39a8b989633a4bef98bc0e065380454a/tiles/v4/layer=50766/EPSG:3857/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.linz.govt.nz/" target="_blank">LINZ</a>'
            }
        },
        layers: [{
            id: 'linzImagery',
            type: 'raster',
            source: 'linzImagery',
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
                attribution: '&copy; <a href="https://www.ign.es" target="_blank">IGN</a>'
            }
        },
        layers: [{
            id: 'ignEs',
            type: 'raster',
            source: 'ignEs',
        }],
    },
    ignEsSatellite: {
        version: 8,
        sources: {
            ignEsSatellite: {
                type: 'raster',
                tiles: ['https://www.ign.es/wmts/pnoa-ma?layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}'],
                tileSize: 256,
                maxzoom: 20,
                attribution: '&copy; <a href="https://www.ign.es" target="_blank">IGN</a>'
            }
        },
        layers: [{
            id: 'ignEsSatellite',
            type: 'raster',
            source: 'ignEsSatellite',
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
            swedenTopoWMTS: {
                type: 'raster',
                tiles: ['https://api.lantmateriet.se/open/topowebb-ccby/v1/wmts/token/1d54dd14-a28c-38a9-b6f3-b4ebfcc3c204/1.0.0/topowebb/default/3857/{z}/{y}/{x}.png'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://www.lantmateriet.se" target="_blank">Lantmäteriet</a>'
            },
            swedenTopoWMS: {
                type: 'raster',
                tiles: ['https://minkarta.lantmateriet.se/map/topowebb?REQUEST=GetMap&SERVICE=WMS&VERSION=1.1.1&FORMAT=image%2Fpng&STYLES=&TRANSPARENT=false&LAYERS=topowebbkartan&TILED=true&MAP_RESOLUTION=180&WIDTH=512&HEIGHT=512&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}'],
                tileSize: 512,
                minzoom: 14,
                maxzoom: 20,
                attribution: '&copy; <a href="https://www.lantmateriet.se" target="_blank">Lantmäteriet</a>'
            }
        },
        layers: [{
            id: 'swedenTopoWMTS',
            type: 'raster',
            source: 'swedenTopoWMTS',
            maxzoom: 14
        }, {
            id: 'swedenTopoWMS',
            type: 'raster',
            source: 'swedenTopoWMS',
            minzoom: 14
        }],
    },
    swedenSatellite: {
        version: 8,
        sources: {
            swedenSatellite: {
                type: 'raster',
                tiles: ['https://minkarta.lantmateriet.se/map/ortofoto?REQUEST=GetMap&SERVICE=WMS&VERSION=1.1.1&FORMAT=image%2Fpng&STYLES=&TRANSPARENT=false&LAYERS=Ortofoto_0.5%2COrtofoto_0.4%2COrtofoto_0.25%2COrtofoto_0.16&TILED=true&MAP_RESOLUTION=180&WIDTH=512&HEIGHT=512&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}'],
                tileSize: 512,
                maxzoom: 22,
                attribution: '&copy; <a href="https://www.lantmateriet.se" target="_blank">Lantmäteriet</a>'
            }
        },
        layers: [{
            id: 'swedenSatellite',
            type: 'raster',
            source: 'swedenSatellite',
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
    qTopo: {
        version: 8,
        sources: {
            qTopo: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/qtopo/{z}/{x}/{y}'],
                //tiles: ['https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Basemaps/QldMap_Topo/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 16,
                minzoom: 3,
                attribution: '&copy; State of Queensland (Department of Natural Resources and Mines, Manufacturing and Regional and Rural Development) 2025'
            }
        },
        layers: [{
            id: 'qTopo',
            type: 'raster',
            source: 'qTopo',
        }],
    },
    qTopoOld: {
        version: 8,
        sources: {
            qTopoOld: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/qtopo_old/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/qtopo_old/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qTopoOld',
            type: 'raster',
            source: 'qTopoOld',
        }],
    },
    qImagery: {
        version: 8,
        sources: {
            qImagery: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/qimagery/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/qimagery/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 19,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qImagery',
            type: 'raster',
            source: 'qImagery',
        }],
    },
    qAerial: {
        version: 8,
        sources: {
            qAerial: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/qaerial/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/qaerial/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 19,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qAerial',
            type: 'raster',
            source: 'qAerial',
        }],
    },
    nswTopo: {
        version: 8,
        sources: {
            nswTopo: {
                type: 'raster',
                tiles: ['https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://maps.six.nsw.gov.au" target="_blank">NSW SIX Maps</a>'
            }
        },
        layers: [{
            id: 'nswTopo',
            type: 'raster',
            source: 'nswTopo',
        }],
    },
    nswBase: {
        version: 8,
        sources: {
            nswBase: {
                type: 'raster',
                tiles: ['https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Base_Map/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 20,
                attribution: '&copy; <a href="https://maps.six.nsw.gov.au" target="_blank">NSW SIX Maps</a>'
            }
        },
        layers: [{
            id: 'nswBase',
            type: 'raster',
            source: 'nswBase',
        }],
    },
    nswImagery: {
        version: 8,
        sources: {
            nswImagery: {
                type: 'raster',
                tiles: ['https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 21,
                attribution: '&copy; <a href="https://maps.six.nsw.gov.au" target="_blank">NSW SIX Maps</a>'
            }
        },
        layers: [{
            id: 'nswImagery',
            type: 'raster',
            source: 'nswImagery',
        }],
    },
    vicImagery: {
        version: 8,
        sources: {
            vicImagery: {
                type: 'raster',
                tiles: ['https://base.maps.vic.gov.au/service?'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://maps.vic.gov.au" target="_blank">Victoria State Government</a>'
            }
        },
        layers: [{
            id: 'vicImagery',
            type: 'raster',
            source: 'vicImagery',
        }],
    },
    saImagery: {
        version: 8,
        sources: {
            saImagery: {
                type: 'raster',
                tiles: ['https://imagemap.geohub.sa.gov.au/mapproxy/wmts/PublicMosaic/webmercator_22/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 19,
                attribution: '&copy; <a href="https://imagemap.geohub.sa.gov.au" target="_blank">South Australia State Government</a>'
            }
        },
        layers: [{
            id: 'saImagery',
            type: 'raster',
            source: 'saImagery',
        }],
    },
    tasTopo: {
        version: 8,
        sources: {
            tasTopo: {
                type: 'raster',
                tiles: ['https://services.thelist.tas.gov.au/arcgis/rest/services/Basemaps/Topographic/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://maps.thelist.tas.gov.au" target="_blank">Tasmania LIST</a>'
            }
        },
        layers: [{
            id: 'tasTopo',
            type: 'raster',
            source: 'tasTopo',
        }],
    },
    tasTopo25k: {
        version: 8,
        sources: {
            tasTopo25k: {
                type: 'raster',
                tiles: ['https://services.thelist.tas.gov.au/arcgis/rest/services/Basemaps/Tasmap25K/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://maps.thelist.tas.gov.au" target="_blank">Tasmania LIST</a>'
            }
        },
        layers: [{
            id: 'tasTopo25k',
            type: 'raster',
            source: 'tasTopo25k',
        }],
    },
    tasBase: {
        version: 8,
        sources: {
            tasBase: {
                type: 'raster',
                tiles: ['https://services.thelist.tas.gov.au/arcgis/rest/services/Basemaps/TasmapRaster/ImageServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://maps.thelist.tas.gov.au" target="_blank">Tasmania LIST</a>'
            }
        },
        layers: [{
            id: 'tasBase',
            type: 'raster',
            source: 'tasBase',
        }],
    },
    tasHillshade: {
        version: 8,
        sources: {
            tasHillshade: {
                type: 'raster',
                tiles: ['https://services.thelist.tas.gov.au/arcgis/rest/services/Basemaps/Hillshade/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://maps.thelist.tas.gov.au" target="_blank">Tasmania LIST</a>'
            }
        },
        layers: [{
            id: 'tasHillshade',
            type: 'raster',
            source: 'tasHillshade',
        }],
    },
    tasImagery: {
        version: 8,
        sources: {
            tasImagery: {
                type: 'raster',
                tiles: ['https://services.thelist.tas.gov.au/arcgis/rest/services/Basemaps/Orthophoto/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 19,
                attribution: '&copy; <a href="https://maps.thelist.tas.gov.au" target="_blank">Tasmania LIST</a>'
            }
        },
        layers: [{
            id: 'tasImagery',
            type: 'raster',
            source: 'tasImagery',
        }],
    },
    getlostTopo: {
        version: 8,
        sources: {
            getlostTopo: {
                type: 'raster',
                //tiles: [`${TILES}/getlost/{z}/{x}/{y}.jpg`],
                tiles: ['https://getlost.wanderstories.space/{z}/{x}/{y}.jpg'],
                tileSize: 256,
                maxzoom: 13,
                minzoom: 2,
                attribution: '&copy; <a href="https://getlost.com.au/" target="_blank">Getlost Maps</a>'
            }
        },
        layers: [{
            id: 'getlostTopo',
            type: 'raster',
            source: 'getlostTopo',
        }],
    },
    natmap50k: {
        version: 8,
        sources: {
            natmap50k: {
                type: 'raster',
                tiles: ['https://natmap.wanderstories.space/natmap50k/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 16,
                attribution: '&copy; <a href="https://natmap.wanderstories.space" target="_blank">NatMaps</a>'
            }
        },
        layers: [{
            id: 'natmap50k',
            type: 'raster',
            source: 'natmap50k',
        }],
    },
    natmap100k: {
        version: 8,
        sources: {
            natmap100k: {
                type: 'raster',
                tiles: ['https://natmap.wanderstories.space/natmap100k/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://natmap.wanderstories.space" target="_blank">NatMaps</a>'
            }
        },
        layers: [{
            id: 'natmap100k',
            type: 'raster',
            source: 'natmap100k',
        }],
    },
    natmap250k: {
        version: 8,
        sources: {
            natmap250k: {
                type: 'raster',
                tiles: ['https://natmap.wanderstories.space/natmap250k/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 12,
                attribution: '&copy; <a href="https://natmap.wanderstories.space" target="_blank">NatMaps</a>'
            }
        },
        layers: [{
            id: 'natmap250k',
            type: 'raster',
            source: 'natmap250k',
        }],
    },
    natmapsTopo: {
        version: 8,
        sources: {
            natmapsTopo: {
                type: 'raster',
                //tiles: [`${TILES}/natmap/natmap/{z}/{x}/{y}`],
                tiles: ['https://natmap.wanderstories.space/natmap/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://natmap.wanderstories.space" target="_blank">NatMaps</a>'
            }
        },
        layers: [{
            id: 'natmapsTopo',
            type: 'raster',
            source: 'natmapsTopo',
        }],
    },
    nafiTopo: {
        version: 8,
        sources: {
            nafiTopo: {
                type: 'raster',
                tiles: ['https://nafi.wanderstories.space/topo/{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 4,
                maxzoom: 12,
                attribution: '&copy; NAFI'
            }
        },
        layers: [{
            id: 'nafiTopo',
            type: 'raster',
            source: 'nafiTopo',
            minzoom: 4,
            maxzoom: 22,
            paint: {
                'raster-resampling': 'linear'
            }              
        }],
    },
    appleSatellite: {
        version: 8,
        sources: {
            appleSatellite: {
                type: 'raster',
                //tiles: [`${TILES}/applemaps/satellite/{z}/{x}/{y}`],
                tiles: ['https://applemaps.wanderstories.space/satellite/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.apple.com/maps" target="_blank">Apple</a>'
            }
        },
        layers: [{
            id: 'appleSatellite',
            type: 'raster',
            source: 'appleSatellite',
        }],
    },
    appleMaps: {
        version: 8,
        sources: {
            appleMaps: {
                type: 'raster',
                //tiles: [`${TILES}/applemaps/standard/{z}/{x}/{y}`],
                tiles: ['https://applemaps.wanderstories.space/standard/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.apple.com/maps" target="_blank">Apple</a>'
            }
        },
        layers: [{
            id: 'appleMaps',
            type: 'raster',
            source: 'appleMaps',
        }],
    },
    yandexSatellite: {
        version: 8,
        sources: { // The projection is EPSG:3395 (Web Mercator)
            yandexSatellite: {
                type: 'raster',
                tiles: ['https://core-sat.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}'], //, 'https://sat0.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}', 'https://sat1.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}', 'https://sat2.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}', 'https://sat3.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}'
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://yandex.com/maps" target="_blank">Yandex</a>'
            }
        },
        layers: [{
            id: 'yandexSatellite',
            type: 'raster',
            source: 'yandexSatellite',
        }],
    },
    libertySatellite: {
        version: 8,
        sources: {
            libertySatellite: {
                type: 'raster',
                tiles: ['https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=LtuJ7yoNmtLdbRSVn9bb'],
                tileSize: 512,
                maxzoom: 22,
                attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
            }
        },
        layers: [{
            id: 'libertySatellite',
            type: 'raster',
            source: 'libertySatellite',
        }],
    },
    arcTopo: {
        version: 8,
        sources: {
            arcTopo: {
                type: 'raster',
                tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.arcgis.com" target="_blank">Esri</a>'
            }
        },
        layers: [{
            id: 'arcTopo',
            type: 'raster',
            source: 'arcTopo',
        }],
    },
    arcImagery: {
        version: 8,
        sources: {
            arcImagery: {
                type: 'raster',
                tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.arcgis.com" target="_blank">Esri</a>'
            }
        },
        layers: [{
            id: 'arcImagery',
            type: 'raster',
            source: 'arcImagery',
        }],
    },
    esriClarity: {
        version: 8,
        sources: {
            esriClarity: {
                type: 'raster',
                tiles: ['https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.arcgis.com" target="_blank">Esri</a>'
            }
        },
        layers: [{
            id: 'esriClarity',
            type: 'raster',
            source: 'esriClarity',
        }],
    },
    esriImagery: {
        version: 8,
        sources: {
            esriImagery: {
                type: 'raster',
                tiles: ['https://wayback.maptiles.arcgis.com/arcgis/rest/services/world_imagery/mapserver/tile/645/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.arcgis.com" target="_blank">Esri</a>'
            }
        },
        layers: [{
            id: 'esriImagery',
            type: 'raster',
            source: 'esriImagery',
        }],
    },
    bingSatellite: {
        version: 8,
        sources: {
            bingSatellite: {
                type: 'raster',
                tiles: ['https://ecn.t0.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=8547'],
                tileSize: 256,
                maxzoom: 19,
                attribution: '&copy; <a href="https://www.microsoft.com/maps" target="_blank">Microsoft</a>'
            }
        },
        layers: [{
            id: 'bingSatellite',
            type: 'raster',
            source: 'bingSatellite',
        }],
    },
    googleSatellite: {
        version: 8,
        sources: {
            googleSatellite: {
                type: 'raster',
                tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.google.com/maps" target="_blank">Google</a>'
            }
        },
        layers: [{
            id: 'googleSatellite',
            type: 'raster',
            source: 'googleSatellite',
        }],
    },
    googleMaps: {
        version: 8,
        sources: {
            googleMaps: {
                type: 'raster',
                tiles: ['https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.google.com/maps" target="_blank">Google</a>'
            }
        },
        layers: [{
            id: 'googleMaps',
            type: 'raster',
            source: 'googleMaps',
        }],
    },
    googleTerrain: {
        version: 8,
        sources: {
            googleTerrain: {
                type: 'raster',
                tiles: ['https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://www.google.com/maps" target="_blank">Google</a>'
            }
        },
        layers: [{
            id: 'googleTerrain',
            type: 'raster',
            source: 'googleTerrain',
        }],
    },
};

export const overlays: { [key: string]: StyleSpecification; } = {
    wsArticleMarkers: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {
            wsArticleMarkers: {
                type: 'geojson',
                data: 'https://maps.wanderstories.space/WanderstoriesArticleMarkers.geojson',
                cluster: true,
                clusterMaxZoom: 14,
                clusterRadius: 50
            }
        },
        layers: [
            // Clusters
            {
                id: 'wsArticleMarkers-clusters',
                type: 'circle',
                source: 'wsArticleMarkers',
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#ffffff',
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        20,
                        10,
                        30,
                        50,
                        40
                    ],
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#cccccc'
                }
            },
            // Cluster count
            {
                id: 'wsArticleMarkers-cluster-count',
                type: 'symbol',
                source: 'wsArticleMarkers',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12
                },
                paint: {
                    'text-color': '#666666'
                }
            },
            // Individual markers
            {
                id: 'wsArticleMarkers-bg',
                type: 'circle',
                source: 'wsArticleMarkers',
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-radius': 15,
                    'circle-color': '#ffffff',
                    'circle-stroke-color': '#cccccc',
                    'circle-stroke-width': 1
                }
            },
            {
                id: 'wsArticleMarkers-w',
                type: 'symbol',
                source: 'wsArticleMarkers',
                filter: ['!', ['has', 'point_count']],
                layout: {
                    'text-field': 'W',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 14,
                    'text-allow-overlap': true,
                    'text-anchor': 'center'
                },
                paint: {
                    'text-color': '#cccccc'
                }
            },
            {
                id: 'wsArticleMarkers-grade',
                type: 'symbol',
                source: 'wsArticleMarkers',
                filter: ['all', 
                    ['!', ['has', 'point_count']],
                    ['has', 'awtgs']
                ],
                layout: {
                    'text-field': ['get', 'awtgs'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 10,
                    'text-allow-overlap': true,
                    'text-anchor': 'center',
                    'text-offset': [0, 0.8]
                },
                paint: {
                    'text-color': '#cccccc'
                }
            },
            // Title labels
            {
                id: 'wsArticleMarkers-title',
                type: 'symbol',
                source: 'wsArticleMarkers',
                filter: ['!', ['has', 'point_count']],
                layout: {
                    'text-field': ['get', 'title'],
                    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                    'text-size': 11,
                    'text-anchor': 'top',
                    'text-offset': [0, 1.5],
                    'text-max-width': 8,
                    'text-allow-overlap': false,
                    'text-ignore-placement': false
                },
                paint: {
                    'text-color': '#666666',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                }
            }
        ]
    },
    qAlerts: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {
            qAlerts: {
                type: 'geojson',
                data: 'https://maps.wanderstories.space/QueenslandNationalParkAlerts.geojson',
                cluster: false
            },
            qTraffic: {
                type: 'geojson',
                data: 'https://data.qldtraffic.qld.gov.au/events_v2.geojson',
                generateId: true,
                cluster: false,
            }
        },
        layers: [
            // Park Alerts Layer
            {
                id: 'qAlerts',
                type: 'circle',
                source: 'qAlerts',
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#ff9800',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            },
            {
                id: 'qAlerts-text',
                type: 'symbol',
                source: 'qAlerts',
                minzoom: 10, // Only show text when zoomed in
                layout: {
                    'text-field': [
                        'concat',
                        ['get', 'id'],
                        ' ',
                        ['get', 'title']
                    ],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-max-width': 8,
                    'text-allow-overlap': false
                },
                paint: {
                    'text-halo-width': 1.5,
                    'text-halo-color': '#fff',
                    'text-color': '#000'
                }
            },
            // Traffic Alerts Layer - Points Only
            {
                id: 'qTraffic',
                type: 'circle',
                source: 'qTraffic',
                filter: ['all',
                    // Filter for Point and Line geometries
                    ['any',
                        ['==', ['get', 'type'], 'Point'],
                        ['==', ['get', 'type'], 'MultiPoint'],
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint'],
                        ['==', ['get', 'type'], 'LineString'],
                        ['==', ['get', 'type'], 'MultiLineString'],
                        ['==', ['geometry-type'], 'LineString'],
                        ['==', ['geometry-type'], 'MultiLineString']
                    ],
                    // Other filters
                    ['!=', ['get', 'event_subtype'], 'Planned roadworks'],
                    ['!=', ['get', 'event_subtype'], 'Stationary vehicle'],
                    ['!=', ['get', 'event_due_to'], 'Pot holes'],
                    ['!', ['all',
                        ['==', ['get', 'advice'], 'Proceed with caution'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!', ['all',
                        ['==', ['get', 'event_subtype'], 'Debris on road'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!=', ['get', 'delay'], 'No delays expected']
                ],
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#2196f3',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            },
            {
                id: 'qTraffic-lines',
                type: 'line',
                source: 'qTraffic',
                filter: ['all',
                    // Filter for Line geometries only
                    ['any',
                        ['==', ['get', 'type'], 'LineString'],
                        ['==', ['get', 'type'], 'MultiLineString'],
                        ['==', ['geometry-type'], 'LineString'],
                        ['==', ['geometry-type'], 'MultiLineString']
                    ],
                    // Other filters
                    ['!=', ['get', 'event_subtype'], 'Planned roadworks'],
                    ['!=', ['get', 'event_subtype'], 'Stationary vehicle'],
                    ['!=', ['get', 'event_due_to'], 'Pot holes'],
                    ['!', ['all',
                        ['==', ['get', 'advice'], 'Proceed with caution'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!', ['all',
                        ['==', ['get', 'event_subtype'], 'Debris on road'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!=', ['get', 'delay'], 'No delays expected']
                ],
                paint: {
                    'line-color': '#2196f3',
                    'line-width': 3,
                    'line-opacity': 0.8
                },
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                }
            },
            {
                id: 'qTraffic-points',
                type: 'circle',
                source: 'qTraffic',
                filter: ['all',
                    // Filter for Point geometries only
                    ['any',
                        ['==', ['get', 'type'], 'Point'],
                        ['==', ['get', 'type'], 'MultiPoint'],
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint']
                    ],
                    // Other filters
                    ['!=', ['get', 'event_subtype'], 'Planned roadworks'],
                    ['!=', ['get', 'event_subtype'], 'Stationary vehicle'],
                    ['!=', ['get', 'event_due_to'], 'Pot holes'],
                    ['!', ['all',
                        ['==', ['get', 'advice'], 'Proceed with caution'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!', ['all',
                        ['==', ['get', 'event_subtype'], 'Debris on road'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!=', ['get', 'delay'], 'No delays expected']
                ],
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#2196f3',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#fff'
                }
            },
            {
                id: 'qTraffic-text-points',
                type: 'symbol',
                source: 'qTraffic',
                minzoom: 10, // Only show text when zoomed in
                filter: ['all',
                    // Only points
                    ['any',
                        ['==', ['get', 'type'], 'Point'],
                        ['==', ['get', 'type'], 'MultiPoint'],
                        ['==', ['geometry-type'], 'Point'],
                        ['==', ['geometry-type'], 'MultiPoint'],
                        ['==', ['get', 'type'], 'LineString'],
                        ['==', ['get', 'type'], 'MultiLineString'],
                        ['==', ['geometry-type'], 'LineString'],
                        ['==', ['geometry-type'], 'MultiLineString']
                    ],
                    // Other filters
                    ['!=', ['get', 'event_subtype'], 'Planned roadworks'],
                    ['!=', ['get', 'event_subtype'], 'Stationary vehicle'],
                    ['!=', ['get', 'event_due_to'], 'Pot holes'],
                    ['!', ['all',
                        ['==', ['get', 'advice'], 'Proceed with caution'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!', ['all',
                        ['==', ['get', 'event_subtype'], 'Debris on road'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!=', ['get', 'delay'], 'No delays expected']
                ],
                layout: {
                    'text-field': [
                        'concat',
                        ['get', 'event_type'],
                        ': ',
                        ['get', 'description']
                    ],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-max-width': 8,
                    'text-allow-overlap': false
                },
                paint: {
                    'text-halo-width': 1.5,
                    'text-halo-color': '#fff',
                    'text-color': '#000'
                }
            },
            {
                id: 'qTraffic-text-lines',
                type: 'symbol',
                source: 'qTraffic',
                minzoom: 10, // Only show text when zoomed in
                filter: ['all',
                    // Only lines
                    ['any',
                        ['==', ['get', 'type'], 'LineString'],
                        ['==', ['get', 'type'], 'MultiLineString'],
                        ['==', ['geometry-type'], 'LineString'],
                        ['==', ['geometry-type'], 'MultiLineString']
                    ],
                    // Other filters
                    ['!=', ['get', 'event_subtype'], 'Planned roadworks'],
                    ['!=', ['get', 'event_subtype'], 'Stationary vehicle'],
                    ['!=', ['get', 'event_due_to'], 'Pot holes'],
                    ['!', ['all',
                        ['==', ['get', 'advice'], 'Proceed with caution'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!', ['all',
                        ['==', ['get', 'event_subtype'], 'Debris on road'],
                        ['!=', ['get', 'event_priority'], 'High']
                    ]],
                    ['!=', ['get', 'delay'], 'No delays expected']
                ],
                layout: {
                    'text-field': [
                        'concat',
                        ['get', 'event_type'],
                        ': ',
                        ['get', 'description']
                    ],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    'symbol-placement': 'line',
                    'text-keep-upright': true,
                    'text-allow-overlap': false,
                    'text-max-angle': 45,
                    'text-padding': 5,
                    'text-offset': [0, 1], // Add offset above the line
                    'text-anchor': 'bottom' // Ensure consistent placement above the line
                },
                paint: {
                    'text-halo-width': 1.5,
                    'text-halo-color': '#fff',
                    'text-color': '#000'
                }
            },
        ]
    },
    qContours: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {
            qContours: {
                type: 'vector',
                tiles: [
                    'https://qldglobe.wanderstories.space/contours/{z}/{x}/{y}'
                ],
                minzoom: 10,
                maxzoom: 23,
                attribution:
                    '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            qWater: {
                type: 'vector',
                tiles: ['https://qldglobe.wanderstories.space/water/{z}/{x}/{y}'],
                minzoom: 6,
                maxzoom: 23,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            qMountainRanges: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/MountainRanges/{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 6,
                maxzoom: 17,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            qParksAdminBoundaries: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/ParksAdminBoundaries/{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 11,
                maxzoom: 16,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [
            // Elevation contours — lines + labels match QLD Hosted Elevation Contours style (root.json)
            {
                id: 'qContours-srtm-10m-index',
                type: 'line',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m',
                filter: ['==', ['get', '_symbol'], 0],
                minzoom: 10,
                maxzoom: 24,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#FFA900',
                    'line-width': 1.33
                }
            },
            {
                id: 'qContours-srtm-10m-intermediate',
                type: 'line',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m',
                filter: ['==', ['get', '_symbol'], 1],
                minzoom: 12,
                maxzoom: 24,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#FFD37F',
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        12,
                        0.53,
                        15,
                        0.8,
                        17,
                        0.93,
                        19,
                        1.07
                    ]
                }
            },
            {
                id: 'qContours-lidar-5m-index',
                type: 'line',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 5m',
                filter: ['==', ['get', '_symbol'], 0],
                minzoom: 15,
                maxzoom: 16,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#FFA900',
                    'line-width': 1.33
                }
            },
            {
                id: 'qContours-lidar-5m-intermediate',
                type: 'line',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 5m',
                filter: ['==', ['get', '_symbol'], 1],
                minzoom: 15,
                maxzoom: 16,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#FFD37F',
                    'line-width': 0.8
                }
            },
            {
                id: 'qContours-lidar-1m-index',
                type: 'line',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 1m',
                filter: ['==', ['get', '_symbol'], 0],
                minzoom: 16,
                maxzoom: 24,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#FFA900',
                    'line-width': 1.33
                }
            },
            {
                id: 'qContours-lidar-1m-intermediate',
                type: 'line',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 1m',
                filter: ['==', ['get', '_symbol'], 1],
                minzoom: 16,
                maxzoom: 24,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': '#FFD37F',
                    'line-width': 0.8
                }
            },
            // Elevation labels (source-layer …/label, field _name — same as Queensland Globe)
            {
                id: 'qContours-label-srtm-index-small',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m/label',
                filter: ['==', ['get', '_label_class'], 0],
                minzoom: 11,
                maxzoom: 12,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 1000,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 8,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#734C00',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-srtm-index-medium',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m/label',
                filter: ['==', ['get', '_label_class'], 1],
                minzoom: 12,
                maxzoom: 15,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 283,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 9.33,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#734C00',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-srtm-index-large',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m/label',
                filter: ['==', ['get', '_label_class'], 2],
                minzoom: 15,
                maxzoom: 24,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 283,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 10.67,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#734C00',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-srtm-intermediate-medium',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m/label',
                filter: ['==', ['get', '_label_class'], 4],
                minzoom: 12,
                maxzoom: 15,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 283,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 9.33,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#897044',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-srtm-intermediate-large',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour SRTM 10m/label',
                filter: ['==', ['get', '_label_class'], 5],
                minzoom: 15,
                maxzoom: 24,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 283,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 10.67,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#897044',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-lidar-5m-index',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 5m/label',
                filter: ['==', ['get', '_label_class'], 0],
                minzoom: 15,
                maxzoom: 16,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 1000,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 10.67,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#734C00',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-lidar-5m-intermediate',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 5m/label',
                filter: ['==', ['get', '_label_class'], 1],
                minzoom: 15,
                maxzoom: 16,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 283,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 10.67,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#897044',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-lidar-1m-index',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 1m/label',
                filter: ['==', ['get', '_label_class'], 0],
                minzoom: 16,
                maxzoom: 24,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 1000,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 10.67,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#734C00',
                    'text-halo-width': 1.33
                }
            },
            {
                id: 'qContours-label-lidar-1m-intermediate',
                type: 'symbol',
                source: 'qContours',
                'source-layer': 'Contour LiDAR 1m/label',
                filter: ['==', ['get', '_label_class'], 1],
                minzoom: 16,
                maxzoom: 24,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 283,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 10.67,
                    'text-letter-spacing': 0.1,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#897044',
                    'text-halo-width': 1.33
                }
            },
            // Water: vector tiles only have line layers (no polygon 'Water area' in this service)
            {
                id: 'qWater-line',
                type: 'line',
                source: 'qWater',
                'source-layer': 'Water area edge',
                paint: {
                    'line-color': '#7eb5d0',
                    'line-width': 1,
                    'line-opacity': 0.8,
                    'line-dasharray': [2, 1]
                },
                minzoom: 6
            },
            {
                id: 'qWater-watercourse',
                type: 'line',
                source: 'qWater',
                'source-layer': 'Watercourse line',
                paint: {
                    'line-color': '#7eb5d0',
                    'line-width': 1.5,
                    'line-opacity': 0.8,
                    'line-dasharray': [6, 4]
                },
                minzoom: 6
            },
            {
                id: 'qWater-coastline',
                type: 'line',
                source: 'qWater',
                'source-layer': 'Coastline',
                paint: {
                    'line-color': '#7eb5d0',
                    'line-width': 1.2,
                    'line-opacity': 0.9
                },
                minzoom: 6
            },
            // Watercourse / waterbody names (vector tile label layers; _name where present)
            {
                id: 'qWater-watercourse-label',
                type: 'symbol',
                source: 'qWater',
                'source-layer': 'Watercourse line/label',
                minzoom: 12,
                maxzoom: 24,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 400,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 16, 11],
                    'text-letter-spacing': 0.05,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#e8f6fc',
                    'text-halo-color': '#1a4a5c',
                    'text-halo-width': 1.25
                }
            },
            {
                id: 'qWater-area-label',
                type: 'symbol',
                source: 'qWater',
                'source-layer': 'Watercourse area /label',
                minzoom: 11,
                maxzoom: 24,
                layout: {
                    'symbol-placement': 'line',
                    'symbol-spacing': 500,
                    'text-field': ['coalesce', ['get', '_name'], ''],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 13],
                    'text-letter-spacing': 0.08,
                    'text-rotation-alignment': 'map',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#e8f6fc',
                    'text-halo-color': '#1a4a5c',
                    'text-halo-width': 1.35
                }
            },
            // Parks admin boundaries (transparent PNG)
            {
                id: 'qContours-parks-admin-boundaries',
                type: 'raster',
                source: 'qParksAdminBoundaries',
                minzoom: 11,
                maxzoom: 24
            },
            // Mountain / range names (transparent PNG; drawn over vector contours)
            {
                id: 'qContours-mountain-ranges',
                type: 'raster',
                source: 'qMountainRanges',
                minzoom: 7,
                maxzoom: 18
            }
        ],
    },
    nafiFireScarsCurrentYear: {
        version: 8,
        sources: {
            nafiFireScarsCurrentYear: {
                type: 'raster',
                tiles: ['https://nafi.wanderstories.space/fire_scar_by_month_current/{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 12,
                maxzoom: 15,
                attribution: '&copy; NAFI'
            }
        },
        layers: [{
            id: 'nafiFireScarsCurrentYear',
            type: 'raster',
            source: 'nafiFireScarsCurrentYear',
        }],
    },
    nafiFireScarsPreviousYear: {
        version: 8,
        sources: {
            nafiFireScarsPreviousYear: {
                type: 'raster',
                tiles: ['https://nafi.wanderstories.space/fire_scar_by_month_previous_year/{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 12,
                maxzoom: 15,
                attribution: '&copy; NAFI'
            }
        },
        layers: [{
            id: 'nafiFireScarsPreviousYear',
            type: 'raster',
            source: 'nafiFireScarsPreviousYear',
        }],
    },
    qFireScarMappingCurrentYear: {
        version: 8,
        sources: {
            qFireScarMappingCurrentYear: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/FireScarMappingCurrentYear/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/FireScarMappingCurrentYear/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 16,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qFireScarMappingCurrentYear',
            type: 'raster',
            source: 'qFireScarMappingCurrentYear',
        }],
    },
    qFireScarMappingLastYear: {
        version: 8,
        sources: {
            qFireScarMappingLastYear: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/FireScarMappingLastYear/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 16,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qFireScarMappingLastYear',
            type: 'raster',
            source: 'qFireScarMappingLastYear',
        }],
    },
    qMines: {
        version: 8,
        sources: {
            qMiningResources: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/MiningResources/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/MiningResources/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            qMinesPermitsHistoric: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/MinesPermitsHistoric/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/MinesPermitsHistoric/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 17,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qMiningResources',
            type: 'raster',
            source: 'qMiningResources',
        },
        {
            id: 'qMinesPermitsHistoric',
            type: 'raster',
            source: 'qMinesPermitsHistoric',
        }],
    },
    qRoads: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {
            qRoads: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/RoadsAndTracks/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/RoadsAndTracks/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 17, // Can do 18
                minzoom: 11, // Can do 8
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            qParks: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/ParksTerrestrialProtectedAreas/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/ParksTerrestrialProtectedAreas/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 17,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            tracksAndRoutes: {
                type: 'vector',
                url: 'mapbox://luenwarneke.ck9jsx4h8055j2sqh20nvyzyi-5zmqy'
            },

        },
        layers: [{
            id: 'qRoads',
            type: 'raster',
            source: 'qRoads',
        },
        {
            id: 'qParks',
            type: 'raster',
            source: 'qParks',
        },
        {
            id: 'tracksAndRoutesLines',
            type: 'line',
            source: 'tracksAndRoutes',
            'source-layer': 'Old_Tracks',
            filter: ['==', '$type', 'LineString'],
            layout: {
                'line-join': 'round',
                'line-cap': 'round',
            },
            paint: {
                //'line-color': '#333',
                'line-color': '#ccc',
                'line-width': 1,
                'line-opacity': 0.7,
                'line-dasharray': [2, 4]
            }
        },
        {
            id: 'tracksAndRoutesPoints',
            type: 'symbol',
            source: 'tracksAndRoutes',
            'source-layer': 'Old_Tracks',
            filter: ['==', '$type', 'Point'],
            //filter: ['all', ['==', '$type', 'Point'], ['!has', 'highway']],
            layout: {
                'text-field': '•',
                'text-size': 14,
                'text-font': ['Arial Unicode MS Regular', 'Open Sans Regular'],
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: {
                'text-color': '#333',
                'text-opacity': 0.7,
            }
        },
        {
            id: 'tracksAndRoutesLabel',
            type: 'symbol',
            source: 'tracksAndRoutes',
            'source-layer': 'Old_Tracks',
            filter: ['has', 'name'],
            minzoom: 12,
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Arial Unicode MS Regular'],
                'text-size': 11,
                'text-offset': [0, 1.5],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#000000',
                'text-halo-color': '#cccccc',
                'text-halo-width': 1
            }
        }],
    },
    osmTracks: 'mapbox://styles/luenwarneke/cm3z47ago00es01pzb5yj1qdm',
    qLandParcel: {
        version: 8,
        sources: {
            qLandParcel: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/CadastralFramework/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/CadastralFramework/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 16,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qLandParcel',
            type: 'raster',
            source: 'qLandParcel'
        }],
    },
    qCadastralPublicAccess: {
        version: 8,
        sources: {
            qCadastralPublicAccess: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/CadastralPublicAccess/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 15,
                minzoom: 9,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            },
            qStockRoutes: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/StockRoutesQld/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 15,
                minzoom: 9,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qCadastralPublicAccess',
            type: 'raster',
            source: 'qCadastralPublicAccess'
        }, {
            id: 'qStockRoutes',
            type: 'raster',
            source: 'qStockRoutes'
        }],
    },
    qStockRoutes: {
        version: 8,
        sources: {
            qStockRoutes: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/StockRoutesQld/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 15,
                minzoom: 10,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qStockRoutes',
            type: 'raster',
            source: 'qStockRoutes'
        }],
    },
    qLandUse: {
        version: 8,
        sources: {
            qLandUse: {
                type: 'raster',
                //tiles: [`${TILES}/qldglobe/landuse/{z}/{x}/{y}`],
                tiles: ['https://qldglobe.wanderstories.space/landuse/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 16,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qLandUse',
            type: 'raster',
            source: 'qLandUse'
        }],
    },
    qDemAzimuth: {
        version: 8,
        sources: {
            qDemAzimuth: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/qlddem_azimuth/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 18,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qDemAzimuth',
            type: 'raster',
            source: 'qDemAzimuth'
        }],
    },
    qDemHillshade: {
        version: 8,
        sources: {
            qDemHillshade: {
                type: 'raster',
                tiles: ['https://qldglobe.wanderstories.space/qlddem_hillshade/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 18,
                minzoom: 11,
                attribution: '&copy; <a href="https://qldglobe.wanderstories.space/" target="_blank">Queensland Government</a>'
            }
        },
        layers: [{
            id: 'qDemHillshade',
            type: 'raster',
            source: 'qDemHillshade'
        }],
    },
    calSlopes: {
        version: 8,
        sources: {
            calSlopes: {
                type: 'raster',
                tiles: [`${TILES}/caltopo/{z}/{x}/{y}`],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://caltopo.com" target="_blank">CalTopo</a>'
            }
        },
        layers: [{
            id: 'calSlopes',
            type: 'raster',
            source: 'calSlopes'
        }],
    },
    indigenousGroups: {
        version: 8,
        sources: {
            indigenousGroups: {
                type: 'raster',
                tiles: [`${TILES}/aiatsis/{z}/{x}/{y}`],
                tileSize: 256,
                maxzoom: 6,
                minzoom: 2,
                attribution: '&copy; <a href="https://aiatsis.gov.au" target="_blank">AIATSIS</a>'
            }
        },
        layers: [{
            id: 'indigenousGroups',
            type: 'raster',
            source: 'indigenousGroups',
        }],
    },
    shipwrecks: {
        version: 8,
        sources: {
            shipwrecks: {
                type: 'raster',
                tiles: [`${TILES}/shipwrecks/?dpi=96&transparent=true&format=png32&layers=show%3A3%2C4%2C5%2C7%2C8%2C9%2C32&bbox={bbox-epsg-3857}&bboxSR=102100&imageSR=102100&size=256%2C256&f=image`],
                tileSize: 256,
                maxzoom: 15,
                attribution: '&copy; <a href="https://www.environment.gov.au/" target="_blank">Australian Government</a>'
            }
        },
        layers: [{
            id: 'shipwrecks',
            type: 'raster',
            source: 'shipwrecks',
        }],
    },
    waterfalls: {
        version: 8,
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {
            waterfalls: {
                type: 'geojson',
                data: 'https://waterfalls.wanderstories.space/data/waterfalls.geojson',
                attribution: '&copy; <a href="https://wanderstories.space" target="_blank">Wanderstories</a>'
            }
        },
        layers: [{
            id: 'waterfalls-symbol',
            type: 'symbol',
            source: 'waterfalls',
            layout: {
                'text-field': '▾',
                'text-font': ['Arial Unicode MS Regular'],
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    2, 16,    // Increased from 12
                    5, 20,    // Increased from 14
                    10, 24,   // Increased from 16
                    15, 28    // Increased from 18
                ],
                'text-allow-overlap': true,
                'text-ignore-placement': true
            },
            paint: {
                'text-color': '#0078D7',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1
            }
        },
        {
            id: 'waterfalls-label',
            type: 'symbol',
            source: 'waterfalls',
            minzoom: 11,
            filter: ['has', 'name'],
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Arial Unicode MS Regular'],
                'text-size': 12,
                'text-offset': [0, 1.5],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#000000',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
            }
        }]
    },
    wanderstoriesHeatmap: {
        version: 8,
        sources: {
            wanderstoriesHeatmap: {
                type: 'raster',
                //tiles: [`${TILES}/heatmap/{z}/{x}/{y}`],
                tiles: ['https://heatmap.wanderstories.space/{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 3,
                maxzoom: 15,
                attribution: '&copy; <a href="https://heatmap.wanderstories.space" target="_blank">Wanderstories</a>'
            }
        },
        layers: [{
            id: 'wanderstoriesHeatmap',
            type: 'raster',
            source: 'wanderstoriesHeatmap',
        }],
    },
    stravaHeatmapAll: {
        version: 8,
        sources: {
            stravaAll: {
                type: 'raster',
                //tiles: [`${TILES}/strava/{z}/{x}/{y}/512/all/hot`],
                tiles: ['https://strava.wanderstories.space/{z}/{x}/{y}/512/all/hot'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://strava.com" target="_blank">Strava</a>'
            }
        },
        layers: [{
            id: 'stravaAll',
            type: 'raster',
            source: 'stravaAll',
        }],
    },
    stravaHeatmapRide: {
        version: 8,
        sources: {
            stravaRide: {
                type: 'raster',
                //tiles: [`${TILES}/strava/{z}/{x}/{y}/512/ride/hot`],
                tiles: ['https://strava.wanderstories.space/{z}/{x}/{y}/512/ride/hot'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://strava.com" target="_blank">Strava</a>'
            }
        },
        layers: [{
            id: 'stravaRide',
            type: 'raster',
            source: 'stravaRide',
        }],
    },
    stravaHeatmapRun: {
        version: 8,
        sources: {
            stravaRun: {
                type: 'raster',
                //tiles: [`${TILES}/strava/{z}/{x}/{y}/512/run/hot`],
                tiles: ['https://strava.wanderstories.space/{z}/{x}/{y}/512/run/hot'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://strava.com" target="_blank">Strava</a>'
            }
        },
        layers: [{
            id: 'stravaRun',
            type: 'raster',
            source: 'stravaRun',
        }],
    },
    stravaHeatmapWater: {
        version: 8,
        sources: {
            stravaWater: {
                type: 'raster',
                //tiles: [`${TILES}/strava/{z}/{x}/{y}/512/water/hot`],
                tiles: ['https://strava.wanderstories.space/{z}/{x}/{y}/512/water/hot'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://strava.com" target="_blank">Strava</a>'
            }
        },
        layers: [{
            id: 'stravaWater',
            type: 'raster',
            source: 'stravaWater',
        }],
    },
    stravaHeatmapWinter: {
        version: 8,
        sources: {
            stravaWinter: {
                type: 'raster',
                //tiles: [`${TILES}/strava/{z}/{x}/{y}/512/winter/hot`],
                tiles: ['https://strava.wanderstories.space/{z}/{x}/{y}/512/winter/hot'],
                tileSize: 256,
                maxzoom: 14,
                attribution: '&copy; <a href="https://strava.com" target="_blank">Strava</a>'
            }
        },
        layers: [{
            id: 'stravaWinter',
            type: 'raster',
            source: 'stravaWinter',
        }],
    },
    trailforksHeatmap: {
        version: 8,
        sources: {
            trailforksHeatmap: {
                type: 'raster',
                //tiles: [`${TILES}/trailforks/heatmap/{z}/{x}/{y}`],
                tiles: ['https://trailforks.wanderstories.space/heatmap/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://trailforks.com" target="_blank">Trailforks</a>'
            }
        },
        layers: [{
            id: 'trailforksHeatmap',
            type: 'raster',
            source: 'trailforksHeatmap',
        }],
    },
    ridewithgpsHeatmap: {
        version: 8,
        sources: {
            ridewithgpsHeatmap: {
                type: 'raster',
                //tiles: [`${TILES}/ridewithgps/heatmap/{z}/{x}/{y}`],
                tiles: ['https://ridewithgps.wanderstories.space/heatmap/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://ridewithgps.com" target="_blank">Ride with GPS</a>'
            }
        },
        layers: [{
            id: 'ridewithgpsHeatmap',
            type: 'raster',
            source: 'ridewithgpsHeatmap',
        }],
    },
    alltrailsHeatmap: {
        version: 8,
        sources: {
            alltrailsHeatmap: {
                type: 'raster',
                tiles: ['https://alltrails.wanderstories.space/tiles/years_1/all/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 15,
                attribution: '&copy; <a href="https://alltrails.com" target="_blank">AllTrails</a>'
            }
        },
        layers: [{
            id: 'alltrailsHeatmap',
            type: 'raster',
            source: 'alltrailsHeatmap',
            paint: {
                'raster-opacity': 1,
                'raster-color': [
                    'interpolate',
                    ['linear'],
                    ['raster-value'],
                    0, 'rgba(150, 0, 150, 0)',
                    1, 'rgba(150, 0, 150, 0.6)',
                    255, 'rgba(150, 0, 150, 1)'
                ],
                'raster-brightness-min': 0.3,
                'raster-brightness-max': 1.0,
                'raster-contrast': 1.0
            }
        }],
    },
    garminHeatmapRoad: {
        version: 8,
        sources: {
            garminHeatmapRoad: {
                type: 'raster',
                //tiles: ['https://connecttile.garmin.com/ROAD_CYCLING/{z}/{x}/{y}.png'],
                //tiles: [`${TILES}/garmin/ROAD_CYCLING/{z}/{x}/{y}.png`],
                tiles: ['https://garmin.wanderstories.space/ROAD_CYCLING/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://connect.garmin.com" target="_blank">Garmin</a>'
            }
        },
        layers: [
            {
                id: 'garminHeatmapRoad',
                type: 'raster',
                source: 'garminHeatmapRoad',
            },
        ],
    },
    garminHeatmapMtb: {
        version: 8,
        sources: {
            garminHeatmapMtb: {
                type: 'raster',
                //tiles: [`${TILES}/garmin/heatmap/MOUNTAIN_BIKING/{z}/{x}/{y}.png`],
                tiles: ['https://garmin.wanderstories.space/heatmap/MOUNTAIN_BIKING/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://connect.garmin.com" target="_blank">Garmin</a>'
            }
        },
        layers: [{
            id: 'garminHeatmapMtb',
            type: 'raster',
            source: 'garminHeatmapMtb',
        }],
    },
    garminHeatmapGravel: {
        version: 8,
        sources: {
            garminHeatmapGravel: {
                type: 'raster',
                //tiles: [`${TILES}/garmin/heatmap/GRAVEL_BIKING/{z}/{x}/{y}.png`],
                tiles: ['https://garmin.wanderstories.space/heatmap/GRAVEL_BIKING/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://connect.garmin.com" target="_blank">Garmin</a>'
            }
        },
        layers: [{
            id: 'garminHeatmapGravel',
            type: 'raster',
            source: 'garminHeatmapGravel',
        }],
    },
    garminHeatmapRunning: {
        version: 8,
        sources: {
            garminHeatmapRunning: {
                type: 'raster',
                //tiles: [`${TILES}/garmin/heatmap/RUNNING/{z}/{x}/{y}.png`],
                tiles: ['https://garmin.wanderstories.space/heatmap/RUNNING/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://connect.garmin.com" target="_blank">Garmin</a>'
            }
        },
        layers: [{
            id: 'garminHeatmapRunning',
            type: 'raster',
            source: 'garminHeatmapRunning',
        }],
    },
    garminHeatmapTrail: {
        version: 8,
        sources: {
            garminHeatmapTrail: {
                type: 'raster',
                //tiles: [`${TILES}/garmin/heatmap/TRAIL_RUNNING/{z}/{x}/{y}.png`],
                tiles: ['https://garmin.wanderstories.space/heatmap/TRAIL_RUNNING/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://connect.garmin.com" target="_blank">Garmin</a>'
            }
        },
        layers: [{
            id: 'garminHeatmapTrail',
            type: 'raster',
            source: 'garminHeatmapTrail',
        }],
    },
    garminHeatmapHiking: {
        version: 8,
        sources: {
            garminHeatmapHiking: {
                type: 'raster',
                //tiles: [`${TILES}/garmin/heatmap/HIKING/{z}/{x}/{y}.png`],
                tiles: ['https://garmin.wanderstories.space/heatmap/HIKING/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://connect.garmin.com" target="_blank">Garmin</a>'
            }
        },
        layers: [{
            id: 'garminHeatmapHiking',
            type: 'raster',
            source: 'garminHeatmapHiking',
        }],
    },
    komootHeatmapAllSports: {
        version: 8,
        sources: {
            komootHeatmapAllSports: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/all-sports/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapAllSports',
            type: 'raster',
            source: 'komootHeatmapAllSports',
        }],
    },
    komootHeatmapAllFootSports: {
        version: 8,
        sources: {
            komootHeatmapAllFootSports: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/all-foot-sports/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapAllFootSports',
            type: 'raster',
            source: 'komootHeatmapAllFootSports',
        }],
    },
    komootHeatmapHike: {
        version: 8,
        sources: {
            komootHeatmapHike: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/hike/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapHike',
            type: 'raster',
            source: 'komootHeatmapHike',
        }],
    },
    komootHeatmapJogging: {
        version: 8,
        sources: {
            komootHeatmapJogging: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/jogging/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapJogging',
            type: 'raster',
            source: 'komootHeatmapJogging',
        }],
    },
    komootHeatmapAllCycleSports: {
        version: 8,
        sources: {
            komootHeatmapAllCycleSports: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/all-cycle-sports/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapAllCycleSports',
            type: 'raster',
            source: 'komootHeatmapAllCycleSports',
        }],
    },
    komootHeatmapTouringbicycle: {
        version: 8,
        sources: {
            komootHeatmapTouringbicycle: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/touringbicycle/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapTouringbicycle',
            type: 'raster',
            source: 'komootHeatmapTouringbicycle',
        }],
    },
    komootHeatmapMtb: {
        version: 8,
        sources: {
            komootHeatmapMtb: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/mtb/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapMtb',
            type: 'raster',
            source: 'komootHeatmapMtb',
        }],
    },
    komootHeatmapRacebike: {
        version: 8,
        sources: {
            komootHeatmapRacebike: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/racebike/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapRacebike',
            type: 'raster',
            source: 'komootHeatmapRacebike',
        }],
    },
    komootHeatmapMtbEasy: {
        version: 8,
        sources: {
            komootHeatmapMtbEasy: {
                type: 'raster',
                tiles: ['https://komoot.wanderstories.space/tiles/mtb-easy/{z}/{x}/{y}.png'],
                tileSize: 256,
                minzoom: 1,
                maxzoom: 12,
                attribution: '&copy; <a href="https://www.komoot.com" target="_blank">Komoot</a>'
            }
        },
        layers: [{
            id: 'komootHeatmapMtbEasy',
            type: 'raster',
            source: 'komootHeatmapMtbEasy',
        }],
    },
    suuntoHeatmapRunning: {
        version: 8,
        sources: {
            suuntoHeatmapRunning: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/Running/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapRunning',
            type: 'raster',
            source: 'suuntoHeatmapRunning',
        }],
    },
    suuntoHeatmapTrailRunning: {
        version: 8,
        sources: {
            suuntoHeatmapTrailRunning: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/TrailRunning/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapTrailRunning',
            type: 'raster',
            source: 'suuntoHeatmapTrailRunning',
        }],
    },
    suuntoHeatmapAllTrails: {
        version: 8,
        sources: {
            suuntoHeatmapAllTrails: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllTrails/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllTrails',
            type: 'raster',
            source: 'suuntoHeatmapAllTrails',
        }],
    },
    suuntoHeatmapAllWalking: {
        version: 8,
        sources: {
            suuntoHeatmapAllWalking: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllWalking/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllWalking',
            type: 'raster',
            source: 'suuntoHeatmapAllWalking',
        }],
    },
    suuntoHeatmapCycling: {
        version: 8,
        sources: {
            suuntoHeatmapCycling: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/Cycling/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapCycling',
            type: 'raster',
            source: 'suuntoHeatmapCycling',
        }],
    },
    suuntoHeatmapMountainBiking: {
        version: 8,
        sources: {
            suuntoHeatmapMountainBiking: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/MountainBiking/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapMountainBiking',
            type: 'raster',
            source: 'suuntoHeatmapMountainBiking',
        }],
    },
    suuntoHeatmapCrosscountrySkiing: {
        version: 8,
        sources: {
            suuntoHeatmapCrosscountrySkiing: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/CrosscountrySkiing/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapCrosscountrySkiing',
            type: 'raster',
            source: 'suuntoHeatmapCrosscountrySkiing',
        }],
    },
    suuntoHeatmapAllDownhill: {
        version: 8,
        sources: {
            suuntoHeatmapAllDownhill: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllDownhill/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllDownhill',
            type: 'raster',
            source: 'suuntoHeatmapAllDownhill',
        }],
    },
    suuntoHeatmapAllSwimming: {
        version: 8,
        sources: {
            suuntoHeatmapAllSwimming: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllSwimming/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllSwimming',
            type: 'raster',
            source: 'suuntoHeatmapAllSwimming',
        }],
    },
    suuntoHeatmapTriathlon: {
        version: 8,
        sources: {
            suuntoHeatmapTriathlon: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/Triathlon/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapTriathlon',
            type: 'raster',
            source: 'suuntoHeatmapTriathlon',
        }],
    },
    suuntoHeatmapAllPaddling: {
        version: 8,
        sources: {
            suuntoHeatmapAllPaddling: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllPaddling/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllPaddling',
            type: 'raster',
            source: 'suuntoHeatmapAllPaddling',
        }],
    },
    suuntoHeatmapAllRollerSports: {
        version: 8,
        sources: {
            suuntoHeatmapAllRollerSports: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllRollerSports/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllRollerSports',
            type: 'raster',
            source: 'suuntoHeatmapAllRollerSports',
        }],
    },
    suuntoHeatmapSkiTouring: {
        version: 8,
        sources: {
            suuntoHeatmapSkiTouring: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/SkiTouring/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapSkiTouring',
            type: 'raster',
            source: 'suuntoHeatmapSkiTouring',
        }],
    },
    suuntoHeatmapMountaineering: {
        version: 8,
        sources: {
            suuntoHeatmapMountaineering: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/Mountaineering/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapMountaineering',
            type: 'raster',
            source: 'suuntoHeatmapMountaineering',
        }],
    },
    suuntoHeatmapAllSurfAndBeach: {
        version: 8,
        sources: {
            suuntoHeatmapAllSurfAndBeach: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/AllSurfAndBeach/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapAllSurfAndBeach',
            type: 'raster',
            source: 'suuntoHeatmapAllSurfAndBeach',
        }],
    },
    suuntoHeatmapGolf: {
        version: 8,
        sources: {
            suuntoHeatmapGolf: {
                type: 'raster',
                tiles: ['https://suunto.wanderstories.space/Golf/{z}/{x}/{y}'],
                tileSize: 256,
                maxzoom: 14,
                minzoom: 8,
                attribution: '&copy; <a href="https://suunto.com" target="_blank">Suunto</a>'
            }
        },
        layers: [{
            id: 'suuntoHeatmapGolf',
            type: 'raster',
            source: 'suuntoHeatmapGolf',
        }],
    },
    osmTraces: {
        version: 8,
        sources: {
            osmTraces: {
                type: 'raster',
                tiles: ['https://a.gps-tile.openstreetmap.org/lines/{z}/{x}/{y}.png', 'https://b.gps-tile.openstreetmap.org/lines/{z}/{x}/{y}.png', 'https://c.gps-tile.openstreetmap.org/lines/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a>'
            }
        },
        layers: [{
            id: 'osmTraces',
            type: 'raster',
            source: 'osmTraces',
        }],
    },
    openSeaMap: {
        version: 8,
        sources: {
            openSeaMapProfile: { // Shading
                type: 'raster',
                tiles: [`${TILES}/openseamap/profile/{bbox-epsg-3857}`],
                tileSize: 256,
                maxzoom: 17,
                minzoom: 3,
                attribution: '&copy; <a href="https://openseamap.org" target="_blank">OpenSeaMap</a>'
            },
            openSeaMapDepth: { // Contours
                type: 'raster',
                tiles: [`${TILES}/openseamap/depth/{bbox-epsg-3857}`],
                // WIDTH=1559&HEIGHT=1418
                tileSize: 1559,
                maxzoom: 17,
                minzoom: 7, // Can do 3
                attribution: '&copy; <a href="https://openseamap.org" target="_blank">OpenSeaMap</a>'
            },
            openSeaMapMarkers: { // POIs
                type: 'raster',
                //tiles: [`${TILES}/openseamap/markers/{z}/{x}/{y}.png`],
                tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
                tileSize: 256,
                maxzoom: 17,
                minzoom: 11,
                attribution: '&copy; <a href="https://openseamap.org" target="_blank">OpenSeaMap</a>'
            }
        },
        layers: [{
            id: 'openSeaMapProfile',
            type: 'raster',
            source: 'openSeaMapProfile',
        },
        {
            id: 'openSeaMapDepth',
            type: 'raster',
            source: 'openSeaMapDepth',
        },
        {
            id: 'openSeaMapMarkers',
            type: 'raster',
            source: 'openSeaMapMarkers',
        }],
    },
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
    bikerouterGravel: bikerouterGravel as StyleSpecification,
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
    gaiaPublicTracks: {
        version: 8,
        sources: {
            gaiaPublicTracks: {
                type: 'vector',
                tiles: ['https://gaia.wanderstories.space/tiles-accumulated/{z}/{x}/{y}'],
                minzoom: 0,
                maxzoom: 14,
                attribution:
                    '&copy; <a href="https://www.gaiagps.com/" target="_blank">Gaia GPS</a> via <a href="https://gaia.wanderstories.space/" target="_blank">Wanderstories</a>'
            }
        },
        layers: [{
            id: 'gaiaTracksLine',
            type: 'line',
            source: 'gaiaPublicTracks',
            'source-layer': 'tracks',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#e63946',
                'line-width': 2,
                'line-opacity': 0.9
            }
        }]
    },
    allTrailsCommunityTrails: {
        version: 8,
        sources: {
            allTrailsCommunityTrails: {
                type: 'vector',
                tiles: [
                    'https://alltrails.wanderstories.space/api/viewport-trails/mvt-accumulated/{z}/{x}/{y}.pbf'
                ],
                minzoom: 8,
                maxzoom: 13,
                attribution:
                    '&copy; <a href="https://www.alltrails.com/" target="_blank">AllTrails</a> via <a href="https://alltrails.wanderstories.space/" target="_blank">Wanderstories</a>'
            }
        },
        layers: [{
            id: 'alltrails-community-trail-lines',
            type: 'line',
            source: 'allTrailsCommunityTrails',
            'source-layer': 'trails',
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            },
            paint: {
                'line-color': '#0d7f3c',
                'line-width': 4,
                'line-opacity': 0.85
            }
        }]
    },
};

export const defaultOpacities: { [key: string]: number; } = {
    ignFrCadastre: 0.5,
    ignSlope: 0.4,
    swisstopoSlope: 0.4,
    calSlopes: 0.5,
    qLandUse: 0.4,
    qStockRoutes: 0.6,
    qCadastralPublicAccess: 0.5,
    qLandParcel: 0.6,
    qContours: 0.5,
    gaiaPublicTracks: 0.9,
    allTrailsCommunityTrails: 0.85,
    wanderstoriesHeatmap: 0.6,
    osmTracks: 0.5,
};

export type LayerTreeType = { [key: string]: LayerTreeType | boolean; };

// Hierarchy containing all basemaps
export const basemapTree: LayerTreeType = {
    basemaps: {
        world: {
            wsOutdoors: true,
            mapboxOutdoors: true,
            openStreetMap: true,
            openTopoMap: true,
            openHikingMap: true,
            cyclOSM: true,
            openCycleMap: true,
            arcTopo: true,
            appleMaps: true,
            googleMaps: true,
            googleTerrain: true,
            mapboxSatellite: true,
            arcImagery: true,
            esriClarity: true,
            esriImagery: true,
            bingSatellite: true,
            googleSatellite: true,
            appleSatellite: true,
            yandexSatellite: true,
            libertySatellite: true,
        },
        countries: {
            australia: {
                qTopo: true,
                qTopoOld: true,
                qImagery: true,
                qAerial: true,
                nswTopo: true,
                nswBase: true,
                nswImagery: true,
                vicImagery: true,
                saImagery: true,
                tasTopo: true,
                tasTopo25k: true,
                tasBase: false,
                tasHillshade: true,
                tasImagery: true,
                nafiTopo: true,
                natmap50k: true,
                natmap100k: true,
                natmap250k: true,
                natmapsTopo: true,
                getlostTopo: true,
            },
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
                linzImagery: true,
            },
            norway: {
                norwayTopo: true,
            },
            spain: {
                ignEs: true,
                ignEsSatellite: true,
            },
            sweden: {
                swedenTopo: true,
                swedenSatellite: true,
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
    }
};

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
            wanderstoriesHeatmap: true,
            stravaHeatmapAll: true,
            stravaHeatmapRide: true,
            stravaHeatmapRun: true,
            stravaHeatmapWater: true,
            stravaHeatmapWinter: true,
            trailforksHeatmap: true,
            ridewithgpsHeatmap: true,
            alltrailsHeatmap: true,
            garminHeatmapRoad: true,
            garminHeatmapMtb: true,
            garminHeatmapGravel: true,
            garminHeatmapRunning: true,
            garminHeatmapTrail: true,
            garminHeatmapHiking: true,
            komootHeatmapAllSports: true,
            komootHeatmapAllFootSports: true,
            komootHeatmapHike: true,
            komootHeatmapJogging: true,
            komootHeatmapAllCycleSports: true,
            komootHeatmapTouringbicycle: true,
            komootHeatmapMtb: true,
            komootHeatmapRacebike: true,
            komootHeatmapMtbEasy: true,
            suuntoHeatmapRunning: true,
            suuntoHeatmapTrailRunning: true,
            suuntoHeatmapAllTrails: true,
            suuntoHeatmapAllWalking: true,
            suuntoHeatmapCycling: true,
            suuntoHeatmapMountainBiking: true,
            suuntoHeatmapCrosscountrySkiing: true,
            suuntoHeatmapAllDownhill: true,
            suuntoHeatmapAllSwimming: true,
            suuntoHeatmapTriathlon: true,
            suuntoHeatmapAllPaddling: true,
            suuntoHeatmapAllRollerSports: true,
            suuntoHeatmapSkiTouring: true,
            suuntoHeatmapMountaineering: true,
            suuntoHeatmapAllSurfAndBeach: true,
            suuntoHeatmapGolf: true,
            osmTraces: true,
            osmTracks: true,
            openSeaMap: true,
            waterfalls: true,
            calSlopes: true,
            wsArticleMarkers: true,
            gaiaPublicTracks: true,
            allTrailsCommunityTrails: true,
        },
        countries: {
            australia: {
                qMines: true,
                qRoads: true,
                qLandUse: true,
                qStockRoutes: true,
                qCadastralPublicAccess: true,
                qLandParcel: true,
                qContours: true,
                qDemAzimuth: true,
                qDemHillshade: true,
                qFireScarMappingCurrentYear: true,
                qFireScarMappingLastYear: true,
                nafiFireScarsCurrentYear: true,
                nafiFireScarsPreviousYear: true,
                shipwrecks: true,
                indigenousGroups: false,
                qAlerts: true,
            },
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
export const defaultBasemap = 'wsOutdoors';

// Default overlays used (none)
export const defaultOverlays: LayerTreeType = {
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
            wanderstoriesHeatmap: false,
            stravaHeatmapAll: false,
            stravaHeatmapRide: false,
            stravaHeatmapRun: false,
            stravaHeatmapWater: false,
            stravaHeatmapWinter: false,
            trailforksHeatmap: false,
            ridewithgpsHeatmap: false,
            alltrailsHeatmap: false,
            garminHeatmapRoad: false,
            garminHeatmapMtb: false,
            garminHeatmapGravel: false,
            garminHeatmapRunning: false,
            garminHeatmapTrail: false,
            garminHeatmapHiking: false,
            komootHeatmapAllSports: false,
            komootHeatmapAllFootSports: false,
            komootHeatmapHike: false,
            komootHeatmapJogging: false,
            komootHeatmapAllCycleSports: false,
            komootHeatmapTouringbicycle: false,
            komootHeatmapMtb: false,
            komootHeatmapRacebike: false,
            komootHeatmapMtbEasy: false,
            suuntoHeatmapRunning: false,
            suuntoHeatmapTrailRunning: false,
            suuntoHeatmapAllTrails: false,
            suuntoHeatmapAllWalking: false,
            suuntoHeatmapCycling: false,
            suuntoHeatmapMountainBiking: false,
            suuntoHeatmapCrosscountrySkiing: false,
            suuntoHeatmapAllDownhill: false,
            suuntoHeatmapAllSwimming: false,
            suuntoHeatmapTriathlon: false,
            suuntoHeatmapAllPaddling: false,
            suuntoHeatmapAllRollerSports: false,
            suuntoHeatmapSkiTouring: false,
            suuntoHeatmapMountaineering: false,
            suuntoHeatmapAllSurfAndBeach: false,
            suuntoHeatmapGolf: false,
            osmTraces: false,
            osmTracks: false,
            openSeaMap: false,
            waterfalls: false,
            calSlopes: false,
            wsArticleMarkers: false,
            gaiaPublicTracks: false,
            allTrailsCommunityTrails: false,
        },
        countries: {
            australia: {
                qMines: false,
                qRoads: false,
                qLandUse: false,
                qStockRoutes: false,
                qCadastralPublicAccess: false,
                qLandParcel: false,
                qContours: false,
                qDemAzimuth: false,
                qDemHillshade: false,
                qFireScarMappingCurrentYear: false,
                qFireScarMappingLastYear: false,
                nafiFireScarsCurrentYear: false,
                nafiFireScarsPreviousYear: false,
                shipwrecks: false,
                indigenousGroups: false,
                qAlerts: false,
            },
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
            wsOutdoors: true,
            mapboxOutdoors: true,
            openStreetMap: true,
            openTopoMap: true,
            openHikingMap: true,
            cyclOSM: true,
            openCycleMap: true,
            arcTopo: false,
            appleMaps: false,
            googleMaps: false,
            googleTerrain: false,
            mapboxSatellite: true,
            arcImagery: true,
            esriClarity: true,
            esriImagery: true,
            bingSatellite: true,
            googleSatellite: true,
            appleSatellite: true,
            yandexSatellite: false,
            libertySatellite: true,
        },
        countries: {
            australia: {
                qTopo: true,
                qTopoOld: false,
                qImagery: true,
                qAerial: true,
                nswTopo: false,
                nswBase: false,
                nswImagery: false,
                vicImagery: false,
                saImagery: false,
                tasTopo: false,
                tasTopo25k: false,
                tasBase: false,
                tasHillshade: false,
                tasImagery: false,
                nafiTopo: true,
                natmap50k: false,
                natmap100k: false,
                natmap250k: false,
                natmapsTopo: true,
                getlostTopo: true,
            },
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
                linzImagery: false,
            },
            norway: {
                norwayTopo: false,
            },
            spain: {
                ignEs: false,
                ignEsSatellite: false,
            },
            sweden: {
                swedenTopo: false,
                swedenSatellite: false,
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
            wanderstoriesHeatmap: true,
            stravaHeatmapAll: false,
            stravaHeatmapRide: false,
            stravaHeatmapRun: false,
            stravaHeatmapWater: false,
            stravaHeatmapWinter: false,
            trailforksHeatmap: false,
            ridewithgpsHeatmap: false,
            alltrailsHeatmap: false,
            garminHeatmapRoad: false,
            garminHeatmapMtb: false,
            garminHeatmapGravel: false,
            garminHeatmapRunning: false,
            garminHeatmapTrail: false,
            garminHeatmapHiking: false,
            komootHeatmapAllSports: false,
            komootHeatmapAllFootSports: false,
            komootHeatmapHike: false,
            komootHeatmapJogging: false,
            komootHeatmapAllCycleSports: false,
            komootHeatmapTouringbicycle: false,
            komootHeatmapMtb: false,
            komootHeatmapRacebike: false,
            komootHeatmapMtbEasy: false,
            suuntoHeatmapRunning: false,
            suuntoHeatmapTrailRunning: false,
            suuntoHeatmapAllTrails: false,
            suuntoHeatmapAllWalking: false,
            suuntoHeatmapCycling: false,
            suuntoHeatmapMountainBiking: false,
            suuntoHeatmapCrosscountrySkiing: false,
            suuntoHeatmapAllDownhill: false,
            suuntoHeatmapAllSwimming: false,
            suuntoHeatmapTriathlon: false,
            suuntoHeatmapAllPaddling: false,
            suuntoHeatmapAllRollerSports: false,
            suuntoHeatmapSkiTouring: false,
            suuntoHeatmapMountaineering: false,
            suuntoHeatmapAllSurfAndBeach: false,
            suuntoHeatmapGolf: false,
            osmTraces: false,
            osmTracks: true,
            openSeaMap: true,
            waterfalls: true,
            calSlopes: true,
            wsArticleMarkers: true,
            gaiaPublicTracks: false,
            allTrailsCommunityTrails: false,
        },
        countries: {
            australia: {
                qMines: true,
                qRoads: true,
                qLandUse: true,
                qStockRoutes: true,
                qCadastralPublicAccess: true,
                qLandParcel: true,
                qContours: true,
                qDemAzimuth: true,
                qDemHillshade: true,
                qFireScarMappingCurrentYear: true,
                qFireScarMappingLastYear: true,
                nafiFireScarsCurrentYear: true,
                nafiFireScarsPreviousYear: true,
                shipwrecks: false,
                indigenousGroups: false,
                qAlerts: true,
            },
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
            svg: Toilet,
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
            natural: ["spring", "water_tap"],
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
