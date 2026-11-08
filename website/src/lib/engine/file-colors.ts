const PALETTE = [
    '#ff0000',
    '#0000ff',
    '#46e646',
    '#00ccff',
    '#ff9900',
    '#ff00ff',
    '#ffff32',
    '#288228',
    '#9933ff',
    '#50f0be',
    '#8c645a',
];

/** GPX style colors are hex digits, with or without the leading `#`. */
export function normalizeColor(color: string): string {
    return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : color;
}

/**
 * Picks the base color of each file: the color defined by the file itself if any, otherwise a
 * palette color, the least used one when the file first shows up. A file keeps its palette color
 * for its whole lifetime, so that it does not change when style information comes and goes
 * (edits, undo, redo).
 */
export class FileColorAllocator {
    /** Palette color reserved for each file. */
    private _reserved = new Map<string, string>();
    /** Color currently displayed for each file. */
    private _base = new Map<string, string>();

    /** Updates (and returns) the base color of a file, given the colors defined by its tracks. */
    resolve(fileId: string, trackColors: (string | undefined)[]): string {
        const explicit = trackColors.find((color) => color !== undefined);
        if (explicit === undefined && !this._reserved.has(fileId)) {
            this._reserved.set(fileId, this.leastUsed());
        }
        const color =
            explicit !== undefined ? normalizeColor(explicit) : this._reserved.get(fileId)!;
        this._base.set(fileId, color);
        return color;
    }

    release(fileId: string) {
        this._reserved.delete(fileId);
        this._base.delete(fileId);
    }

    private leastUsed(): string {
        const usage = new Map(PALETTE.map((color) => [color, 0]));
        this._base.forEach((color) => {
            const count = usage.get(color);
            if (count !== undefined) {
                usage.set(color, count + 1);
            }
        });
        return PALETTE.reduce((a, b) => (usage.get(a)! <= usage.get(b)! ? a : b));
    }
}
