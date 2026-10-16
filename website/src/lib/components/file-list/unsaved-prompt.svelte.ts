import type { UnsavedChoice } from '$lib/engine';

type Prompt =
    | { kind: 'unsaved'; names: string[]; resolve: (choice: UnsavedChoice | 'cancel') => void }
    | {
          kind: 'overwrite';
          names: string[];
          resolve: (choice: 'overwrite' | 'reload' | 'cancel') => void;
      };

/** The question that the user is asked, shown by `UnsavedDialog`. */
export const unsavedPrompt: { current: Prompt | undefined } = $state({ current: undefined });

/**
 * Asks what to do with files that have unsaved changes when they are closed: save them, discard
 * the changes, or `'cancel'` to keep going as before.
 */
export function askUnsaved(names: string[]): Promise<UnsavedChoice | 'cancel'> {
    return new Promise((resolve) => {
        unsavedPrompt.current = { kind: 'unsaved', names, resolve };
    });
}

/**
 * Asks what to do with files that have changes and were also changed on the disk: `'overwrite'` the
 * disk, `'reload'` the disk (the changes are lost), or `'cancel'`.
 */
export function askOverwrite(names: string[]): Promise<'overwrite' | 'reload' | 'cancel'> {
    return new Promise((resolve) => {
        unsavedPrompt.current = { kind: 'overwrite', names, resolve };
    });
}
