import { type AnySourceData, type Style } from 'mapbox-gl';

export const mapboxAccessToken = 'pk.eyJ1IjoiZ3B4c3R1ZGlvIiwiYSI6ImNrdHVoM2pjNTBodmUycG1yZTNwcnJ3MzkifQ.YZnNs9s9oCQPzoXAWs_SLg';

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
    linz: 'https://basemaps.linz.govt.nz/v1/tiles/topographic/EPSG:3857/style/topographic.json?api=d01fbtg0ar23gctac5m0jgyy2ds',
    swisstopo: {
        version: 8,
        sources: {
            swisstopo: {
                type: 'raster',
                tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg'],
                tileSize: 256,
                maxzoom: 18,
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
            }
        },
        layers: [{
            id: 'swisstopo',
            type: 'raster',
            source: 'swisstopo',
        }],
    },
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
    ignPlanV2: {
        version: 8,
        sources: {
            ignPlanV2: {
                type: 'raster',
                tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'],
                tileSize: 256,
                maxzoom: 18,
                attribution: 'IGN-F/Géoportail'
            }
        },
        layers: [{
            id: 'ignPlanV2',
            type: 'raster',
            source: 'ignPlanV2',
        }],
    },
    ignFrScan25: {
        version: 8,
        sources: {
            ignFrScan25: {
                type: 'raster',
                tiles: ['https://wxs.ign.fr/ifj1o8jmglxpfn6p1tn4b3g1/geoportail/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&FORMAT=image/jpeg&STYLE=normal'], // new url https://data.geopf.fr/private/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&FORMAT=image/jpeg&STYLE=normal&apikey=ign_scan_ws
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
    ignSatellite: {
        version: 8,
        sources: {
            ignSatellite: {
                type: 'raster',
                tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'],
                tileSize: 256,
                maxzoom: 19,
                attribution: 'IGN-F/Géoportail'
            }
        },
        layers: [{
            id: 'ignSatellite',
            type: 'raster',
            source: 'ignSatellite',
        }],
    },
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
    ordnanceSurvey: {
        version: 8,
        sources: {
            ordnanceSurvey: {
                type: 'raster',
                tiles: ['https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=piCT8WysfuC3xLSUW7sGLfrAAJoYDvQz'],
                tileSize: 256,
                maxzoom: 20,
                attribution: '&copy; <a href="http://www.ordnancesurvey.co.uk/" target="_blank">Ordnance Survey</a>'
            }
        },
        layers: [{
            id: 'ordnanceSurvey',
            type: 'raster',
            source: 'ordnanceSurvey',
        }],
    },
    norwayTopo: {
        version: 8,
        sources: {
            norwayTopo: {
                type: 'raster',
                tiles: ['https://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4&zoom={z}&x={x}&y={y}', 'https://opencache2.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4&zoom={z}&x={x}&y={y}', 'https://opencache3.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4&zoom={z}&x={x}&y={y}'],
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

Object.values(basemaps).forEach((basemap) => {
    if (typeof basemap === 'object') {
        basemap["glyphs"] = "mapbox://fonts/mapbox/{fontstack}/{range}.pbf";
        basemap["sprite"] = `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/sprite?access_token=${mapboxAccessToken}`;
    }
});

export const overlays: { [key: string]: AnySourceData; } = {
    cyclOSMlite: {
        type: 'raster',
        tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png', 'https://b.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png', 'https://c.tile-cyclosm.openstreetmap.fr/cyclosm-lite/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    swisstopoSlope: {
        type: 'raster',
        tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.hangneigung-ueber_30/default/current/3857/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>',
    },
    swisstopoCycling: {
        type: 'raster',
        tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.astra.veloland/default/current/3857/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
    },
    swisstopoMountainBike: {
        type: 'raster',
        tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.astra.mountainbikeland/default/current/3857/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
    },
    swisstopoSkiTouring: {
        type: 'raster',
        tiles: ['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo-karto.skitouren/default/current/3857/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 17,
        attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>'
    },
    ignFrCadastre: {
        type: 'raster',
        tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}&LAYER=CADASTRALPARCELS.PARCELS&FORMAT=image/png&STYLE=normal'],
        tileSize: 256,
        maxzoom: 20,
        attribution: 'IGN-F/Géoportail'
    },
    ignSlope: {
        type: 'raster',
        tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TileMatrixSet=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&Layer=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&FORMAT=image/png&Style=normal'],
        tileSize: 256,
        maxzoom: 17,
        attribution: 'IGN-F/Géoportail'
    },
    ignSkiTouring: {
        type: 'raster',
        tiles: ['https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&TileMatrixSet=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&Layer=TRACES.RANDO.HIVERNALE&FORMAT=image/png&Style=normal'],
        tileSize: 256,
        maxzoom: 16,
        attribution: 'IGN-F/Géoportail'
    },
    waymarkedTrailsHiking: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    },
    waymarkedTrailsCycling: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    },
    waymarkedTrailsMTB: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    },
    waymarkedTrailsSkating: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/skating/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    },
    waymarkedTrailsHorseRiding: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/riding/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    },
    waymarkedTrailsWinter: {
        type: 'raster',
        tiles: ['https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 18,
        attribution: '&copy; <a href="https://www.waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    },
};

export const opacities: { [key: string]: number; } = {
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
            bulgaria: {
                bgMountains: true,
            },
            finland: {
                finlandTopo: true,
            },
            france: {
                ignPlanV2: true,
                ignFrScan25: true,
                ignSatellite: true
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
                swisstopo: true,
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
            cyclOSM: {
                cyclOSMlite: true,
            },
            waymarked_trails: {
                waymarkedTrailsHiking: true,
                waymarkedTrailsCycling: true,
                waymarkedTrailsMTB: true,
                waymarkedTrailsSkating: true,
                waymarkedTrailsHorseRiding: true,
                waymarkedTrailsWinter: true,
            }
        },
        countries: {
            france: {
                ignFrCadastre: true,
                ignSlope: true,
                ignSkiTouring: true,
            },
            switzerland: {
                swisstopoSlope: true,
                swisstopoCycling: true,
                swisstopoMountainBike: true,
                swisstopoSkiTouring: true,
            }
        },
    },
}

// Default basemap used
export const defaultBasemap = 'mapboxOutdoors';

// Default overlays used (none)
export const defaultOverlays = {
    overlays: {
        world: {
            cyclOSM: {
                cyclOSMlite: false,
            },
            waymarked_trails: {
                waymarkedTrailsHiking: false,
                waymarkedTrailsCycling: false,
                waymarkedTrailsMTB: false,
                waymarkedTrailsSkating: false,
                waymarkedTrailsHorseRiding: false,
                waymarkedTrailsWinter: false,
            }
        },
        countries: {
            france: {
                ignFrCadastre: false,
                ignSlope: false,
                ignSkiTouring: false,
            },
            switzerland: {
                swisstopoSlope: false,
                swisstopoCycling: false,
                swisstopoMountainBike: false,
                swisstopoSkiTouring: false,
            }
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
            bulgaria: {
                bgMountains: false,
            },
            finland: {
                finlandTopo: false,
            },
            france: {
                ignPlanV2: false,
                ignFrScan25: false,
                ignSatellite: false
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
                swisstopo: false,
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
            cyclOSM: {
                cyclOSMlite: true,
            },
            waymarked_trails: {
                waymarkedTrailsHiking: true,
                waymarkedTrailsCycling: true,
                waymarkedTrailsMTB: true,
                waymarkedTrailsSkating: false,
                waymarkedTrailsHorseRiding: false,
                waymarkedTrailsWinter: false,
            }
        },
        countries: {
            france: {
                ignFrCadastre: false,
                ignSlope: false,
                ignSkiTouring: false,
            },
            switzerland: {
                swisstopoSlope: false,
                swisstopoCycling: false,
                swisstopoMountainBike: false,
                swisstopoSkiTouring: false,
            }
        },
    }
}