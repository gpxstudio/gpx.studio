import type { LayerTreeType } from "$lib/assets/layers";

export function anySelectedLayer(node: LayerTreeType) {
    return Object.keys(node).find((id) => {
        if (typeof node[id] == "boolean") {
            if (node[id]) {
                return true;
            }
        } else {
            if (anySelectedLayer(node[id])) {
                return true;
            }
        }
        return false;
    }) !== undefined;
}

export function getLayers(node: LayerTreeType, layers: { [key: string]: boolean } = {}): { [key: string]: boolean } {
    Object.keys(node).find((id) => {
        if (typeof node[id] == "boolean") {
            layers[id] = node[id];
        } else {
            getLayers(node[id], layers);
        }
    });
    return layers;
}