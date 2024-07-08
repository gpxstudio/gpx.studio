export const languages: Record<string, string> = {
    'en': 'English',
};

export function getURLForLanguage(lang?: string): string {
    let currentPath = window.location.pathname;
    let currentPathArray = currentPath.split('/');

    if (currentPathArray.length > 1 && languages.hasOwnProperty(currentPathArray[1])) {
        currentPathArray.splice(1, 1);
    }

    if (lang !== undefined && lang !== 'en') {
        currentPathArray.splice(1, 0, lang);
    }

    return currentPathArray.join('/');
}