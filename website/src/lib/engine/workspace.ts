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
