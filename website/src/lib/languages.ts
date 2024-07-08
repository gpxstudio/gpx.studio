export const languages: Record<string, string> = {
    'en': 'English',
};

export function getURLForLanguage(route: string | null, lang: string | null | undefined): string {
    if (route === null) {
        return '/';
    }

    let url = route.replace('[...language]', (lang === null || lang === undefined) ? 'en' : lang).replace('/en', '');

    if (url === '') {
        return '/';
    } else {
        return url;
    }
}