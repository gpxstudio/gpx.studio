/** `\` and `/` alike. */
function parts(path: string): string[] {
    return path.split(/[\\/]+/).filter((part) => part !== '');
}

/** The name of the folder, the last part of its path. */
export function folderName(folder: string): string {
    return parts(folder).at(-1) ?? folder;
}

/**
 * Where a file is in the open folder: the folders between them, as a path (`''` if it is in the
 * folder itself). `undefined` for a file that is not in the folder (or not on the disk).
 */
export function subfolder(
    folder: string | undefined,
    path: string | undefined
): string | undefined {
    if (folder === undefined || path === undefined) {
        return undefined;
    }
    const root = parts(folder);
    const file = parts(path);
    if (file.length <= root.length || root.some((part, i) => part !== file[i])) {
        return undefined;
    }
    return file.slice(root.length, -1).join('/');
}

/** The id of the open file that is linked to the file at `path`, `undefined` if there is none. */
export function fileIdAt(
    workspace: { files: Record<string, { path?: string }> } | undefined,
    path: string
): string | undefined {
    return Object.entries(workspace?.files ?? {}).find(([, file]) => file.path === path)?.[0];
}

/** The folder that holds `path`. */
export function parentOf(path: string): string {
    const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return index > 0 ? path.slice(0, index) : path;
}

/** Whether `path` is `folder` or something in it. */
export function isWithin(path: string, folder: string): boolean {
    return path === folder || (path.startsWith(folder) && /[\\/]/.test(path[folder.length]));
}

/** The name of a file without its extension, or the name of a folder (`isDir`). */
export function editableName(name: string, isDir: boolean): string {
    const dot = name.lastIndexOf('.');
    return isDir || dot <= 0 ? name : name.slice(0, dot);
}
