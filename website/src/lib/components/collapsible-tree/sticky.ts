import type { StuckRows } from './utils.svelte';

/**
 * Where the row of a node of a sticky tree sticks: under the rows of the nodes it is in, which stay
 * in view as long as some of their content can be seen.
 */
export type StickyLevel = {
    /** Whether the rows stick. */
    readonly enabled: boolean;
    /** How far from the top of the scrolled area the rows of this level stick. */
    readonly top: number;
    /** How many nodes the rows of this level are in. */
    readonly depth: number;
    /** Which rows of the tree are stuck. */
    readonly stuckRows: StuckRows;
};

/** The key of the context that holds the `StickyLevel`. */
export const stickyKey = 'collapsible-tree-sticky';

/** The rows of the outer levels are above the ones of the inner levels. */
export function stickyZIndex(depth: number): number {
    return Math.max(100 - depth, 1);
}

/** The first ancestor that scrolls (or clips), which a sticky row sticks to. */
function scrollParent(node: HTMLElement): HTMLElement | null {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowY !== 'visible') {
            return parent;
        }
    }
    return null;
}

/**
 * Tells whether a sticky row is stuck, and in view: it is held at `top()` from the top of the
 * scrolled area, further down than the beginning of the node it is in. A row that is on its way out
 * with the end of its node (pushed up under the row of the node above) is not.
 */
export function trackStuck(
    row: HTMLElement,
    top: () => number,
    onChange: (stuck: boolean) => void
) {
    const node = row.parentElement;
    const scroller = scrollParent(row);
    if (!node || !scroller) {
        return;
    }
    let stuck = false;
    let frame = 0;
    const check = () => {
        frame = 0;
        const rowTop = row.getBoundingClientRect().top;
        const held = scroller.getBoundingClientRect().top + scroller.clientTop + top();
        const now =
            rowTop - node.getBoundingClientRect().top > 0.5 && Math.abs(rowTop - held) < 0.5;
        if (now !== stuck) {
            stuck = now;
            onChange(stuck);
        }
    };
    const schedule = () => {
        if (!frame) {
            frame = requestAnimationFrame(check);
        }
    };
    scroller.addEventListener('scroll', schedule, { passive: true });
    // the node changes when it is opened or closed, or its content does
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    schedule();
    return () => {
        scroller.removeEventListener('scroll', schedule);
        observer.disconnect();
        cancelAnimationFrame(frame);
    };
}
