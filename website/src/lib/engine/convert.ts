/** A flat `[lng, lat, ...]` array as positions. */
export function toPositions(flat: Float64Array): [number, number][] {
    const positions: [number, number][] = new Array(flat.length / 2);
    for (let i = 0; i < positions.length; i++) {
        positions[i] = [flat[2 * i], flat[2 * i + 1]];
    }
    return positions;
}
