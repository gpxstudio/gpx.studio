import { guides } from '$lib/components/docs/docs.js';

async function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    let subguide = guide.includes('/') ? guide.split('/').pop() : undefined;
    if (subguide) {
        guide = guide.replace(`/${subguide}`, '');
    }
    return subguide
        ? await import(`./../../../lib/docs/${language}/${guide}/${subguide}.mdx`)
        : await import(`./../../../lib/docs/${language}/${guide}.mdx`);
}

export async function load({ params }) {
    const { language } = params;

    const guideTitles: Record<string, string> = {};
    for (let guide of Object.keys(guides)) {
        {
            const module = await getModule(language, guide);
            guideTitles[guide] = module.metadata.title;
        }
        for (let subguide of guides[guide]) {
            const module = await getModule(language, `${guide}/${subguide}`);
            guideTitles[`${guide}/${subguide}`] = module.metadata.title;
        }
    }

    return {
        guideTitles
    };
}