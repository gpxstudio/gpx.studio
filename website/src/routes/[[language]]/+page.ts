async function getModule(language: string | undefined, guide: string) {
    language = language ?? 'en';
    return await import(`./../../lib/docs/${language}/home/${guide}.mdx`);
}

export async function load({ params }) {
    const { language } = params;


    const fundingModule = await getModule(language, 'funding');
    const translationModule = await getModule(language, 'translation');
    const mapboxModule = await getModule(language, 'mapbox');

    return {
        fundingComponent: fundingModule.default,
        translationComponent: translationModule.default,
        mapboxComponent: mapboxModule.default,
    };
}