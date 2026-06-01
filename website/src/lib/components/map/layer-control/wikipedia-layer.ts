import { get } from 'svelte/store';
import { getLayers } from './utils';
import { i18n } from '$lib/i18n.svelte';
import { MapPopup } from '$lib/components/map/map-popup';
import { settings } from '$lib/logic/settings';
import { ANCHOR_LAYER_KEY } from '$lib/components/map/style';
import { loadSVGIcon } from '$lib/utils';
import type { MapLayerEventManager } from '$lib/components/map/map-layer-event-manager';
import { MapPin } from 'lucide-static';

const { currentOverlays } = settings;

const WIKIPEDIA_SOURCE_ID = 'wiki';
const WIKIPEDIA_ICON_ID = 'wiki-marker-pin';
const WIKIPEDIA_LAYER_ID = 'wiki';
const WIKIPEDIA_LABEL_LAYER_ID = 'wiki-label';
const WIKIPEDIA_SOURCE_LAYER = 'wiki';
const WIKIPEDIA_ARTICLE_CACHE_LIMIT = 500;
// TODO: change to real tile URL when available.
const WIKIPEDIA_TILE_URL = 'http://localhost:8000/pbf/{lang}_tiles/{z}/{x}/{y}.pbf';

type WikipediaTileProperties = {
    label: string;
    wiki_title: string;
};

export class WikipediaPopupArticle {
    lon: number;
    lat: number;
    article_title: string;
    name: string;
    description?: string;
    image_url?: string;
    article_url?: string;
    image_license_name?: string;
    image_license_url?: string;
    loading?: boolean;

    constructor(article: WikipediaPopupArticle) {
        this.lon = article.lon;
        this.lat = article.lat;
        this.article_title = article.article_title;
        this.name = article.name;
        Object.assign(this, article);
    }
}

export class WikipediaLayer {
    map: maplibregl.Map;
    layerEventManager: MapLayerEventManager;
    popup: MapPopup;
    currentTileUrl: string | undefined;
    ignoreClickUntil = 0;
    currentArticleRequestKey: string | undefined;
    articleCache = new Map<string, Promise<WikipediaPopupArticle>>();

    unsubscribes: (() => void)[] = [];

    updateBinded = this.update.bind(this);
    onHoverBinded = this.onHover.bind(this);
    onClickBinded = this.onClick.bind(this);
    onTouchStartBinded = this.onTouchStart.bind(this);
    onMouseLeaveBinded = this.onMouseLeave.bind(this);

    constructor(map: maplibregl.Map, layerEventManager: MapLayerEventManager) {
        this.map = map;
        this.layerEventManager = layerEventManager;
        this.popup = new MapPopup(map, {
            closeButton: false,
            focusAfterOpen: false,
            maxWidth: undefined,
            offset: 15,
        });
    }

    add() {
        this.map.on('style.load', this.updateBinded);
        this.unsubscribes.push(currentOverlays.subscribe(this.updateBinded));
        this.update();
    }

    update() {
        try {
            if (!this.map.getLayer(ANCHOR_LAYER_KEY.overlays)) return;

            const overlays = get(currentOverlays);
            const isWikiSelected = overlays ? getLayers(overlays).wiki === true : false;
            if (!isWikiSelected) {
                this.removeMapLayers();
                this.popup.setItem(null);
                return;
            }

            const tileUrl = WIKIPEDIA_TILE_URL.replace('{lang}', getWikiTileLanguage(i18n.lang));
            if (this.map.getSource(WIKIPEDIA_SOURCE_ID) && this.currentTileUrl !== tileUrl) {
                this.removeMapLayers();
            }

            if (!this.map.getSource(WIKIPEDIA_SOURCE_ID)) {
                // Keep this dynamic because the tile path depends on the active UI language.
                this.map.addSource(WIKIPEDIA_SOURCE_ID, {
                    type: 'vector',
                    tiles: [tileUrl],
                    minzoom: 7,
                    maxzoom: 14,
                    attribution:
                        '© <a href="https://www.wikipedia.org/" target="_blank">Wikipedia contributors</a> ' +
                        '© <a href="https://www.wikidata.org/" target="_blank">Wikidata contributors</a>',
                });
                this.currentTileUrl = tileUrl;
            }

            this.loadIcon();

            if (!this.map.getLayer(WIKIPEDIA_LAYER_ID)) {
                this.map.addLayer(
                    {
                        id: WIKIPEDIA_LAYER_ID,
                        type: 'symbol',
                        source: WIKIPEDIA_SOURCE_ID,
                        'source-layer': WIKIPEDIA_SOURCE_LAYER,
                        layout: {
                            'icon-image': WIKIPEDIA_ICON_ID,
                            'icon-size': 0.25,
                            'icon-padding': 0,
                            'icon-allow-overlap': ['step', ['zoom'], false, 14, true],
                        },
                    },
                    ANCHOR_LAYER_KEY.overlays
                );
                this.registerEvents(WIKIPEDIA_LAYER_ID);
            }

            if (!this.map.getLayer(WIKIPEDIA_LABEL_LAYER_ID)) {
                this.map.addLayer(
                    {
                        id: WIKIPEDIA_LABEL_LAYER_ID,
                        type: 'symbol',
                        source: WIKIPEDIA_SOURCE_ID,
                        'source-layer': WIKIPEDIA_SOURCE_LAYER,
                        minzoom: 13,
                        layout: {
                            'text-field': ['get', 'label'],
                            'text-size': 12,
                            'text-offset': [0, 0.35],
                            'text-anchor': 'top',
                            'text-optional': true,
                        },
                        paint: {
                            'text-color': '#1e293b',
                            'text-halo-color': '#ffffff',
                            'text-halo-width': 1.5,
                        },
                    },
                    ANCHOR_LAYER_KEY.overlays
                );
            }
        } catch (e) {
            // No reliable way to check if the map is ready to remove sources and layers
        }
    }

    private loadIcon() {
        loadSVGIcon(
            this.map,
            WIKIPEDIA_ICON_ID,
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="20" fill="#0ea5e9" />
                <g transform="translate(8 8)">
                    ${MapPin.replace('stroke="currentColor"', 'stroke="white"')}
                </g>
            </svg>`
        );
    }

    remove() {
        this.map.off('style.load', this.updateBinded);
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
        this.removeMapLayers();
        this.popup.remove();
    }

    private removeMapLayers() {
        try {
            this.unregisterEvents(WIKIPEDIA_LAYER_ID);
            if (this.map.getLayer(WIKIPEDIA_LABEL_LAYER_ID)) {
                this.map.removeLayer(WIKIPEDIA_LABEL_LAYER_ID);
            }
            if (this.map.getLayer(WIKIPEDIA_LAYER_ID)) {
                this.map.removeLayer(WIKIPEDIA_LAYER_ID);
            }
            if (this.map.getSource(WIKIPEDIA_SOURCE_ID)) {
                this.map.removeSource(WIKIPEDIA_SOURCE_ID);
            }
            this.currentTileUrl = undefined;
        } catch (e) {
            // No reliable way to check if the map is ready to remove sources and layers.
        }
    }

    private registerEvents(layerId: string) {
        this.layerEventManager.on('mouseenter', layerId, this.onHoverBinded);
        this.layerEventManager.on('mouseleave', layerId, this.onMouseLeaveBinded);
        this.layerEventManager.on('click', layerId, this.onClickBinded);
        this.layerEventManager.on('touchstart', layerId, this.onTouchStartBinded);
    }

    private unregisterEvents(layerId: string) {
        this.layerEventManager.off('mouseenter', layerId, this.onHoverBinded);
        this.layerEventManager.off('mouseleave', layerId, this.onMouseLeaveBinded);
        this.layerEventManager.off('click', layerId, this.onClickBinded);
        this.layerEventManager.off('touchstart', layerId, this.onTouchStartBinded);
    }

    private onHover(e: maplibregl.MapLayerMouseEvent) {
        this.map.getCanvas().style.cursor = 'pointer';
        this.showPopup(e.features?.[0]);
    }

    private async onClick(e: maplibregl.MapLayerMouseEvent) {
        if (Date.now() < this.ignoreClickUntil) return;
        const feature = e.features?.[0];
        if (!feature) return;

        const article = createPopupArticleFromFeature(feature);

        try {
            const resolvedArticle = await this.resolveArticle(article);
            if (resolvedArticle.article_url) {
                window.open(resolvedArticle.article_url, '_blank', 'noopener,noreferrer');
            }
        } catch {
            const fallbackUrl = getFallbackArticleUrl(article);
            if (fallbackUrl) {
                window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
            }
        }
    }

    private onTouchStart(e: maplibregl.MapLayerTouchEvent) {
        this.ignoreClickUntil = Date.now() + 500;
        this.showPopup(e.features?.[0]);
    }

    private onMouseLeave() {
        this.map.getCanvas().style.cursor = '';
    }

    private showPopup(feature: maplibregl.MapGeoJSONFeature | undefined) {
        if (!feature) return;

        const article = createPopupArticleFromFeature(feature);

        const requestKey = getArticleRequestKey(article);
        this.currentArticleRequestKey = requestKey;
        this.popup.setItem({
            item: new WikipediaPopupArticle({
                ...article,
                loading: true,
            }),
        });
        this.resolveArticle(article)
            .then((resolvedArticle) => {
                // Prevent from showing other article if user
                // moved to another marker while request was loading
                if (this.currentArticleRequestKey !== requestKey) {
                    return;
                }

                this.popup.setItem({
                    item: new WikipediaPopupArticle(resolvedArticle),
                });
            })
            .catch(() => {
                if (this.currentArticleRequestKey !== requestKey) {
                    return;
                }
                this.popup.setItem({
                    item: new WikipediaPopupArticle({
                        ...article,
                        loading: false,
                    }),
                });
            });
    }

    private resolveArticle(article: WikipediaPopupArticle) {
        const requestKey = getArticleRequestKey(article);
        const cachedArticle = this.articleCache.get(requestKey);
        if (cachedArticle) {
            this.articleCache.delete(requestKey);
            this.articleCache.set(requestKey, cachedArticle);
            return cachedArticle;
        }

        const articlePromise = fetchWikipediaArticle(article).catch((error) => {
            this.articleCache.delete(requestKey);
            throw error;
        });
        this.articleCache.set(requestKey, articlePromise);
        while (this.articleCache.size > WIKIPEDIA_ARTICLE_CACHE_LIMIT) {
            const oldestKey = this.articleCache.keys().next().value;
            if (!oldestKey) break;
            this.articleCache.delete(oldestKey);
        }
        return articlePromise;
    }
}

function getWikiTileLanguage(lang: string) {
    const tileLanguageOverrides: Record<string, string> = {
        'pt-BR': 'pt',
        'zh-HK': 'zh',
    };

    return tileLanguageOverrides[lang] ?? (lang || 'en');
}

function createPopupArticleFromFeature(
    feature: maplibregl.MapGeoJSONFeature
): WikipediaPopupArticle {
    const properties = feature.properties as WikipediaTileProperties;
    const coordinates = (feature.geometry as GeoJSON.Point).coordinates;

    return new WikipediaPopupArticle({
        lon: coordinates[0],
        lat: coordinates[1],
        name: properties.label,
        article_title: properties.wiki_title,
    });
}

function getArticleRequestKey(article: WikipediaPopupArticle) {
    return [getWikiTileLanguage(i18n.lang), article.article_title].join(':');
}

async function fetchWikipediaArticle(
    article: WikipediaPopupArticle
): Promise<WikipediaPopupArticle> {
    const lang = getWikiTileLanguage(i18n.lang);
    const page = await fetchWikipediaPage(article, lang);
    const imageLicense = page.pageimage
        ? await fetchWikipediaImageLicense(page.pageimage, lang).catch(() => undefined)
        : undefined;

    return new WikipediaPopupArticle({
        ...article,
        name: page.title,
        description: page.extract,
        image_url: page.thumbnail?.source ?? page.original?.source,
        article_url: page.fullurl ?? getWikipediaArticleUrl(lang, article.article_title),
        image_license_name: imageLicense?.name,
        image_license_url: imageLicense?.url,
        loading: false,
    });
}

async function fetchWikipediaPage(article: WikipediaPopupArticle, lang: string) {
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    const params: Record<string, string> = {
        action: 'query',
        format: 'json',
        formatversion: '2',
        origin: '*',
        redirects: '1',
        prop: 'extracts|pageimages|info',
        exintro: '1',
        explaintext: '1',
        inprop: 'url',
        piprop: 'thumbnail|original|name',
        pithumbsize: '640',
        titles: article.article_title,
    };

    url.search = new URLSearchParams(params).toString();
    const data = await fetchJson(url);
    const page = data.query?.pages?.[0];
    if (!page || page.missing) throw new Error('Wikipedia article not found');
    return page;
}

async function fetchWikipediaImageLicense(filename: string, lang: string) {
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        origin: '*',
        prop: 'imageinfo',
        iiprop: 'extmetadata|url',
        titles: `File:${filename}`,
    }).toString();

    const data = await fetchJson(url);
    const metadata = data.query?.pages?.[0]?.imageinfo?.[0]?.extmetadata;
    const name = htmlToText(metadata?.LicenseShortName?.value);
    return {
        name,
        url: sanitizeHttpUrl(metadata?.LicenseUrl?.value),
    };
}

async function fetchJson(url: URL) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wikipedia API request failed: ${response.status}`);
    return await response.json();
}

function getFallbackArticleUrl(article: WikipediaPopupArticle) {
    return getWikipediaArticleUrl(getWikiTileLanguage(i18n.lang), article.article_title);
}

function getWikipediaArticleUrl(lang: string, title: string | undefined) {
    return title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}` : undefined;
}

function sanitizeHttpUrl(value: string | undefined) {
    // Allow only HTTP(S) URLs to prevent potential XSS
    if (!value) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

function htmlToText(value: string | undefined) {
    if (!value) return undefined;
    return new DOMParser().parseFromString(value, 'text/html').body.textContent ?? undefined;
}
