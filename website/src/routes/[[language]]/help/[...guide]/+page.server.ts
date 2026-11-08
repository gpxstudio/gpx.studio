import { languages } from '$lib/i18n/languages';
import { guides } from '$lib/components/docs/docs';
import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () => {
    const entries = [];
    for (const lang of Object.keys(languages)) {
        for (const guide of Object.keys(guides)) {
            entries.push({
                language: lang == 'en' ? '' : lang,
                guide,
            });
            for (const subguide of guides[guide]) {
                entries.push({
                    language: lang == 'en' ? '' : lang,
                    guide: `${guide}/${subguide}`,
                });
            }
        }
    }
    return entries;
};
