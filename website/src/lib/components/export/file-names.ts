// The names of the files that are exported come from the files of the user, which can have any
// text as a name: they have to be made names that every system accepts.

/** Characters that no system accepts in a file name, or that mean something in a path. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f]/g;

/** Names that Windows keeps for devices, with or without an extension. */
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/** Longest name, without the extension, in characters. */
const MAX_LENGTH = 100;

/** A name for a file without its extension, that is allowed on every system. */
export function sanitizeFileName(name: string): string {
    let clean = name
        .replace(FORBIDDEN, '_')
        .normalize('NFC')
        // no dots or spaces around the name: Windows drops them, a leading dot hides the file
        .replace(/^[\s.]+|[\s.]+$/g, '');
    clean = [...clean]
        .slice(0, MAX_LENGTH)
        .join('')
        .replace(/[\s.]+$/, '');
    if (clean === '') {
        return 'file';
    }
    return RESERVED.test(clean.split('.')[0]) ? `_${clean}` : clean;
}

/**
 * The names of files that go in the same folder (the same zip): clean, and different, even where
 * the file system does not tell upper and lower case apart. A name that is taken gets `-1`, `-2`...
 */
export function uniqueFileNames(names: string[]): string[] {
    const taken = new Set<string>();
    return names.map((name) => {
        const clean = sanitizeFileName(name);
        let unique = clean;
        for (let i = 1; taken.has(unique.toLowerCase()); i++) {
            // the suffix is part of the length
            unique = `${[...clean].slice(0, MAX_LENGTH - `-${i}`.length).join('')}-${i}`;
        }
        taken.add(unique.toLowerCase());
        return unique;
    });
}
