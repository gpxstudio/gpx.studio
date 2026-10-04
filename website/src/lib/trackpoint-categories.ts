/**
 * The value of a trackpoint for a category of the engine (surface, highway): `codes` has one entry
 * per trackpoint, 0 when the value is unknown, else 1 + the index of the value in `names`.
 */
export function categoryAt(
    codes: ArrayLike<number>,
    names: readonly string[],
    index: number
): string | undefined {
    const code = codes[index];
    return code ? names[code - 1] : undefined;
}
