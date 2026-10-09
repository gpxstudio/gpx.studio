import type { SelectMode } from './types';

export type Wasm = typeof import('gpx-rs');

/** The enumeration of the engine for a way to combine a selection. */
export function selectMode(wasm: Wasm, mode: SelectMode) {
    return {
        replace: wasm.SelectMode.Replace,
        add: wasm.SelectMode.Add,
        toggle: wasm.SelectMode.Toggle,
    }[mode];
}

/** A flat `[lng, lat, ...]` array as positions. */
export function toPositions(flat: Float64Array): [number, number][] {
    const positions: [number, number][] = new Array(flat.length / 2);
    for (let i = 0; i < positions.length; i++) {
        positions[i] = [flat[2 * i], flat[2 * i + 1]];
    }
    return positions;
}

export /** Hyphenated UUID strings (as found in the file structures) to the concatenated 16-byte form. */
function idsToBytes(ids: string[]): Uint8Array {
    const bytes = new Uint8Array(ids.length * 16);
    ids.forEach((id, i) => {
        const hex = id.replaceAll('-', '');
        for (let j = 0; j < 16; j++) {
            bytes[i * 16 + j] = parseInt(hex.slice(2 * j, 2 * j + 2), 16);
        }
    });
    return bytes;
}
