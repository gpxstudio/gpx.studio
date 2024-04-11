import { type Map, type IControl } from 'mapbox-gl';

export default class CustomControl implements IControl {
    _map: Map | undefined;
    _container: HTMLElement;

    constructor(container: HTMLElement) {
        this._container = container;
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        return this._container;
    }

    onRemove() {
        this._container?.parentNode?.removeChild(this._container);
        this._map = undefined;
    }
}