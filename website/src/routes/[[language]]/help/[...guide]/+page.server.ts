import { getNextGuide, getPreviousGuide } from "$lib/components/docs/docs";

function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    let subguide = undefined;
    if (guide.includes('/')) {
        [guide, subguide] = guide.split('/');
    }
    return subguide
        ? import(`./../../../../lib/docs/${language}/${guide}/${subguide}.mdx`)
        : import(`./../../../../lib/docs/${language}/${guide}.mdx`);
}

export async function load({ params }) {
    const { guide, language } = params;

    const previousGuide = getPreviousGuide(guide);
    const nextGuide = getNextGuide(guide);

    const previousGuideTitle = previousGuide ? (await getModule(language, previousGuide)).metadata.title : undefined;
    const nextGuideTitle = nextGuide ? (await getModule(language, nextGuide)).metadata.title : undefined;

    return {
        previousGuide,
        previousGuideTitle,
        nextGuide,
        nextGuideTitle
    };
}