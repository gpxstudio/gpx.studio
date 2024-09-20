import { guides } from '$lib/components/docs/docs.js';

function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    let subguide = guide.includes('/') ? guide.split('/').pop() : undefined;
    if (subguide) {
        guide = guide.replace(`/${subguide}`, '');
    }
    return subguide
        ? import(`./../../../lib/docs/${language}/${guide}/${subguide}.mdx`)
        : import(`./../../../lib/docs/${language}/${guide}.mdx`);
}

export async function load({ params }) {
    const { language } = params;

    const guideModules: Record<string, any> = {};
    for (let guide of Object.keys(guides)) {
        guideModules[guide] = getModule(language, guide);
        for (let subguide of guides[guide]) {
            guideModules[`${guide}/${subguide}`] = getModule(language, `${guide}/${subguide}`);
        }
    }

    return {
        guideModules
    };
}