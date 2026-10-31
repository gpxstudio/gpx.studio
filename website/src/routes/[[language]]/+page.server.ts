import { languages } from '$lib/i18n/languages';
import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () => {
    return Object.keys(languages).map((lang) => ({ language: lang == 'en' ? '' : lang }));
};
