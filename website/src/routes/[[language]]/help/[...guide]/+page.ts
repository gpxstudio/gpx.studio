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

    const guideModule = await getModule(language, guide);

    return {
        guideModule,
    };
}