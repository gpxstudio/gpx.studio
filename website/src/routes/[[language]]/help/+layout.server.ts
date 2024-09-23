import { guides } from '$lib/components/docs/docs.js';

function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    let subguide = undefined;
    if (guide.includes('/')) {
        [guide, subguide] = guide.split('/');
    }
    return subguide
        ? import(`./../../../lib/docs/${language}/${guide}/${subguide}.mdx`)
        : import(`./../../../lib/docs/${language}/${guide}.mdx`);
}

export async function load({ params }) {
    const { language } = params;

    const guideTitles: Record<string, string> = {};
    for (let guide of Object.keys(guides)) {
        guideTitles[guide] = (await getModule(language, guide)).metadata.title;
        for (let subguide of guides[guide]) {
            guideTitles[`${guide}/${subguide}`] = (await getModule(language, `${guide}/${subguide}`)).metadata.title;
        }
    }

    return {
        guideTitles
    };
}