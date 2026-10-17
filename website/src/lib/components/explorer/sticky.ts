/** The height of a row of the explorer. */
export const rowHeight = 28;

/**
 * The style of the row of a folder that is `depth` folders deep (0 for the open folder), to stick
 * under the rows of the folders it is in while any of its content can be seen: the rows of the
 * folders above are above it too.
 */
export function stickyRowStyle(depth: number): string {
    return `top: ${depth * rowHeight}px; height: ${rowHeight}px; z-index: ${Math.max(100 - depth, 1)};`;
}
