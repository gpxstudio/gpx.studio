import { writable, type Writable } from 'svelte/store';

export enum Tool {
    ROUTING,
    WAYPOINT,
    SCISSORS,
    TIME,
    MERGE,
    EXTRACT,
    ELEVATION,
    REDUCE,
    CLEAN,
    MAP_MATCHING,
}

export const currentTool: Writable<Tool | null> = writable(null);
