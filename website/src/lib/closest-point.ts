const metersPerDegree = 111320;

/**
 * Index of the point of a polyline (flat `[lng, lat, ...]` coordinates) that is the closest to
 * `point`, among the two ends of the segment of the polyline that passes the closest to it.
 * `undefined` for an empty polyline. Planar approximation, like the one used to simplify tracks.
 */
export function closestPointIndex(
    coordinates: ArrayLike<number>,
    point: { lng: number; lat: number }
): number | undefined {
    const count = Math.floor(coordinates.length / 2);
    if (count === 0) {
        return undefined;
    }
    const kx = Math.cos((point.lat * Math.PI) / 180) * metersPerDegree;
    const ky = metersPerDegree;
    const px = point.lng * kx;
    const py = point.lat * ky;
    const x = (i: number) => coordinates[2 * i] * kx - px;
    const y = (i: number) => coordinates[2 * i + 1] * ky - py;

    let best = 0;
    let bestDistance = Number.MAX_VALUE;
    for (let i = 0; i < count - 1; i++) {
        const [ax, ay, bx, by] = [x(i), y(i), x(i + 1), y(i + 1)];
        const [dx, dy] = [bx - ax, by - ay];
        const length = dx * dx + dy * dy;
        // the point is at the origin: the closest position on the segment, as a ratio
        const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
        const distance = Math.hypot(ax + t * dx, ay + t * dy);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = t < 0.5 ? i : i + 1;
        }
    }
    return best;
}
