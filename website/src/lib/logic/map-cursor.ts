import { map } from '$lib/components/map/map';
import { get, writable, type Writable } from 'svelte/store';

export enum MapCursorState {
    DEFAULT,
    LAYER_HOVER,
    WAYPOINT_DRAGGING,
    TRACKPOINT_DRAGGING,
    TOOL_WITH_CROSSHAIR,
    SCISSORS,
    MAPILLARY_HOVER,
    STREET_VIEW_CROSSHAIR,
}

const scissorsCursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" version="1.1"><path d="M 3.200 3.200 C 0.441 5.959, 2.384 9.516, 7 10.154 C 10.466 10.634, 10.187 13.359, 6.607 13.990 C 2.934 14.637, 1.078 17.314, 2.612 19.750 C 4.899 23.380, 10 21.935, 10 17.657 C 10 16.445, 12.405 13.128, 15.693 9.805 C 18.824 6.641, 21.066 3.732, 20.674 3.341 C 20.283 2.950, 18.212 4.340, 16.072 6.430 C 12.019 10.388, 10 10.458, 10 6.641 C 10 2.602, 5.882 0.518, 3.200 3.200 M 4.446 5.087 C 3.416 6.755, 5.733 8.667, 7.113 7.287 C 8.267 6.133, 7.545 4, 6 4 C 5.515 4, 4.816 4.489, 4.446 5.087 M 14 14.813 C 14 16.187, 19.935 21.398, 20.667 20.667 C 21.045 20.289, 20.065 18.634, 18.490 16.990 C 15.661 14.036, 14 13.231, 14 14.813 M 4.446 17.087 C 3.416 18.755, 5.733 20.667, 7.113 19.287 C 8.267 18.133, 7.545 16, 6 16 C 5.515 16, 4.816 16.489, 4.446 17.087" stroke="black" stroke-width="1.2" fill="white" fill-rule="evenodd"/></svg>') 12 12, auto`;
const cursorStyles = {
    [MapCursorState.DEFAULT]: 'default',
    [MapCursorState.LAYER_HOVER]: 'pointer',
    [MapCursorState.WAYPOINT_DRAGGING]: 'grabbing',
    [MapCursorState.TRACKPOINT_DRAGGING]: 'grabbing',
    [MapCursorState.TOOL_WITH_CROSSHAIR]: 'crosshair',
    [MapCursorState.SCISSORS]: scissorsCursor,
    [MapCursorState.MAPILLARY_HOVER]: 'pointer',
    [MapCursorState.STREET_VIEW_CROSSHAIR]: 'crosshair',
};

export class MapCursor {
    private _states: Writable<Set<MapCursorState>>;

    constructor() {
        this._states = writable(new Set());
        this._states.subscribe((states) => {
            let state = Array.from(states.values()).reduce((max, value) => {
                return value > max ? value : max;
            }, MapCursorState.DEFAULT);
            let canvas = get(map)?.getCanvas();
            if (canvas) {
                canvas.style.cursor = cursorStyles[state];
            }
        });
    }

    notify(cursorState: MapCursorState, isActive: boolean) {
        this._states.update((states) => {
            if (isActive) {
                states.add(cursorState);
            } else {
                states.delete(cursorState);
            }
            return states;
        });
    }
}

export const mapCursor = new MapCursor();
