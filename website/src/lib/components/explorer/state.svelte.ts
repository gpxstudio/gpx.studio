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

/** `\` and `/` alike. */
function isSeparator(char: string | undefined) {
    return char === '/' || char === '\\';
}

/** The folder that holds `path`. */
export function parentOf(path: string): string {
    const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return index > 0 ? path.slice(0, index) : path;
}

/** Whether `path` is `folder` or something in it. */
export function isWithin(path: string, folder: string): boolean {
    return path === folder || (path.startsWith(folder) && isSeparator(path[folder.length]));
}

/** The name of a file without its extension, or the name of a folder. */
export function editableName(name: string, isDir: boolean): string {
    const dot = name.lastIndexOf('.');
    return isDir || dot <= 0 ? name : name.slice(0, dot);
}
