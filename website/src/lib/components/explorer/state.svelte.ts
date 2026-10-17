/** The file that the user just selected by clicking it in the explorer, until the selection changes. */
export const clickedInExplorer: { path: string | undefined } = $state({ path: undefined });

/**
 * What is selected in the explorer (files and folders, by path), which the menu and dragging act
 * on, and where a range selected with shift begins.
 */
export const explorerSelection: { paths: string[]; anchor: string | undefined } = $state({
    paths: [],
    anchor: undefined,
});

/** The file or folder whose name is being edited in the explorer. */
export const renaming: { path: string | undefined } = $state({ path: undefined });

/**
 * The file or folder that is being made in a folder (`parent`) of the explorer: it is only made once
 * the user gave it a name.
 */
export const creating: { parent: string | undefined; kind: 'file' | 'folder' } = $state({
    parent: undefined,
    kind: 'file',
});

/** What is dragged in the explorer, and the folder it would be dropped in. */
export const dragging: { paths: string[]; target: string | undefined } = $state({
    paths: [],
    target: undefined,
});

/** The rows of the explorer that `element` is in, as they are shown: their path and kind. */
export function treeRows(element: Element | null | undefined): { path: string; kind: string }[] {
    const tree = element?.closest('[data-explorer]');
    return [...(tree?.querySelectorAll<HTMLElement>('[data-explorer-path]') ?? [])].map((row) => ({
        path: row.dataset.explorerPath!,
        kind: row.dataset.kind!,
    }));
}
