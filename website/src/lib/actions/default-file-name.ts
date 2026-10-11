/**
 * The name of a new file: the default name (translated), followed by a number when other files
 * already have a default name (the name alone counts as number 1): "New file", "New file 2",
 * "New file 3"...
 */
export function defaultFileName(defaultName: string, existingNames: string[]): string {
    let highest = 0;
    for (const name of existingNames) {
        if (name === defaultName) {
            highest = Math.max(highest, 1);
        } else if (name.startsWith(`${defaultName} `)) {
            const suffix = name.slice(defaultName.length + 1);
            if (/^[1-9][0-9]*$/.test(suffix)) {
                highest = Math.max(highest, parseInt(suffix));
            }
        }
    }
    return highest === 0 ? defaultName : `${defaultName} ${highest + 1}`;
}
