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
    return closestIndex(
        Math.floor(coordinates.length / 2),
        (i) => coordinates[2 * i],
        (i) => coordinates[2 * i + 1],
        point
    );
}

/**
 * Like `closestPointIndex`, for the points `from` (included) to `to` (excluded) of a polyline
 * given as the arrays of its longitudes and latitudes. The index is the one in the arrays.
 */
export function closestPointIndexIn(
    lng: ArrayLike<number>,
    lat: ArrayLike<number>,
    from: number,
    to: number,
    point: { lng: number; lat: number }
): number | undefined {
    const closest = closestIndex(
        Math.max(0, to - from),
        (i) => lng[from + i],
        (i) => lat[from + i],
        point
    );
    return closest === undefined ? undefined : from + closest;
}

function closestIndex(
    count: number,
    lngAt: (index: number) => number,
    latAt: (index: number) => number,
    point: { lng: number; lat: number }
): number | undefined {
    if (count === 0) {
        return undefined;
    }
    const kx = Math.cos((point.lat * Math.PI) / 180) * metersPerDegree;
    const ky = metersPerDegree;
    const px = point.lng * kx;
    const py = point.lat * ky;
    const x = (i: number) => lngAt(i) * kx - px;
    const y = (i: number) => latAt(i) * ky - py;

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
