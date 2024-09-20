function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    return import(`./../../lib/docs/${language}/home/${guide}.mdx`);
}

export async function load({ params }) {
    const { language } = params;

    return {
        fundingModule: getModule(language, 'funding'),
        translationModule: getModule(language, 'translation'),
        mapboxModule: getModule(language, 'mapbox'),
    };
}