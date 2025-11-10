import { languages } from '$lib/languages';
import { guides } from '$lib/components/docs/docs';
import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () => {
    let entries = [];
    for (let lang of Object.keys(languages)) {
        for (let guide of Object.keys(guides)) {
            entries.push({
                language: lang == 'en' ? '' : lang,
                guide,
            });
            for (let subguide of guides[guide]) {
                entries.push({
                    language: lang == 'en' ? '' : lang,
                    guide: `${guide}/${subguide}`,
                });
            }
        }
    }
    return entries;
};
