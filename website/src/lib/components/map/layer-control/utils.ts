import type { LayerTreeType } from '$lib/data/layers';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/** Parts of a style that apply to a whole map, not to an overlay. */
const ignoredStyleProperties = ['sprite', 'glyphs', 'terrain', 'sky', 'light', 'projection'];
/** The overlays that were warned about those: a style at a URL is read again and again. */
const warnedOverlays = new Set<string>();

/**
 * A copy of the style of an overlay whose sources and layers have ids of their own, so that they
 * cannot clash with the ones of gpx.studio or of another overlay.
 */
export function prefixStyle(overlayId: string, style: StyleSpecification): StyleSpecification {
    if (typeof style !== 'object' || style === null || !Array.isArray(style.layers)) {
        throw new Error(`The style of overlay ${overlayId} must have a list of layers.`);
    }
    const ignored = ignoredStyleProperties.filter((property) => Object.hasOwn(style, property));
    if (ignored.length > 0 && !warnedOverlays.has(overlayId)) {
        warnedOverlays.add(overlayId);
        console.warn(`Overlay ${overlayId} ignores these style properties: ${ignored.join(', ')}.`);
    }

    const prefixed = (id: string) => `${overlayId}/${id}`;
    const sources = style.sources ?? {};
    const layerIds = new Set<string>();
    const layers = style.layers.map((layer) => {
        if (!layer.id || layerIds.has(layer.id)) {
            throw new Error(`Overlay ${overlayId} has a missing or repeated layer id.`);
        }
        layerIds.add(layer.id);
        if ('source' in layer) {
            if (!Object.hasOwn(sources, layer.source)) {
                throw new Error(
                    `Layer ${layer.id} of overlay ${overlayId} uses unknown source ${layer.source}.`
                );
            }
            return { ...layer, id: prefixed(layer.id), source: prefixed(layer.source) };
        }
        return { ...layer, id: prefixed(layer.id) };
    }) as LayerSpecification[];

    return {
        ...style,
        sources: Object.fromEntries(
            Object.entries(sources).map(([id, source]) => [prefixed(id), source])
        ),
        layers,
    };
}

/** The paint properties that make a layer transparent, by type of layer. */
const opacityProperties: Partial<Record<LayerSpecification['type'], string[]>> = {
    background: ['background-opacity'],
    circle: ['circle-opacity', 'circle-stroke-opacity'],
    'color-relief': ['color-relief-opacity'],
    fill: ['fill-opacity'],
    'fill-extrusion': ['fill-extrusion-opacity'],
    heatmap: ['heatmap-opacity'],
    line: ['line-opacity'],
    raster: ['raster-opacity'],
    symbol: ['icon-opacity', 'text-opacity'],
};

/**
 * The paint properties that give a layer an opacity. The opacity of an overlay applies on top of
 * those of its layers, so that they stay different from one another. A value that is computed
 * (an expression) cannot always be scaled: the opacity replaces it, unless it is left at 1.
 */
export function getOpacityPaint(
    layer: LayerSpecification,
    opacity: number
): Record<string, unknown> {
    if (layer.type === 'hillshade') {
        return { 'hillshade-exaggeration': opacity / 2 };
    }
    const paint = (layer.paint ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
        (opacityProperties[layer.type] ?? []).map((property) => {
            const value = paint[property];
            if (typeof value === 'number') {
                return [property, value * opacity];
            }
            return [property, value !== undefined && opacity === 1 ? value : opacity];
        })
    );
}

export function anySelectedLayer(node: LayerTreeType) {
    return (
        Object.keys(node).find((id) => {
            if (typeof node[id] == 'boolean') {
                if (node[id]) {
                    return true;
                }
            } else {
                if (anySelectedLayer(node[id])) {
                    return true;
                }
            }
            return false;
        }) !== undefined
    );
}

export function getLayers(
    node: LayerTreeType,
    layers: { [key: string]: boolean } = {}
): { [key: string]: boolean } {
    Object.keys(node).forEach((id) => {
        if (typeof node[id] == 'boolean') {
            layers[id] = node[id];
        } else {
            getLayers(node[id], layers);
        }
    });
    return layers;
}

export function isSelected(node: LayerTreeType, id: string) {
    return Object.keys(node).some((key) => {
        if (key === id) {
            return node[key];
        }
        if (typeof node[key] !== 'boolean' && isSelected(node[key], id)) {
            return true;
        }
        return false;
    });
}

export function toggle(node: LayerTreeType, id: string) {
    Object.keys(node).forEach((key) => {
        if (key === id) {
            node[key] = !node[key];
        } else if (typeof node[key] !== 'boolean') {
            toggle(node[key], id);
        }
    });
    return node;
}

export function remove(node: LayerTreeType, id: string) {
    Object.keys(node).forEach((key) => {
        if (key === id) {
            delete node[key];
        } else if (typeof node[key] !== 'boolean') {
            remove(node[key], id);
        }
    });
    return node;
}

export function removeAll(node: LayerTreeType, ids: string[]) {
    Object.keys(node).forEach((key) => {
        if (ids.includes(key)) {
            delete node[key];
        } else if (typeof node[key] !== 'boolean') {
            removeAll(node[key], ids);
        }
    });
    return node;
}
