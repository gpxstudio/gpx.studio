import { getNextGuide, getPreviousGuide } from "$lib/components/docs/docs";

async function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    let subguide = guide.includes('/') ? guide.split('/').pop() : undefined;
    if (subguide) {
        guide = guide.replace(`/${subguide}`, '');
    }
    return subguide
        ? await import(`./../../../../lib/docs/${language}/${guide}/${subguide}.mdx`)
        : await import(`./../../../../lib/docs/${language}/${guide}.mdx`);
}

export async function load({ params }) {
    const { guide, language } = params;

    const previousGuide = getPreviousGuide(guide);
    const nextGuide = getNextGuide(guide);

    const module = await getModule(language, guide);
    const previousModule = previousGuide ? await getModule(language, previousGuide) : undefined;
    const nextModule = nextGuide ? await getModule(language, nextGuide) : undefined;
    return {
        component: module.default,
        previousGuide,
        previousGuideTitle: previousModule?.metadata.title,
        nextGuide,
        nextGuideTitle: nextModule?.metadata.title,
    };
}