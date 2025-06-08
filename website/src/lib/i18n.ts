import { derived, writable, get } from 'svelte/store';

export const locale = writable('');

type Dictionary = {
    [key: string]: string | Dictionary;
};
export const dictionary = writable<Dictionary>({});

export const isLoadingInitialLocale = writable<boolean>(true);
export const isLoadingLocale = writable<boolean>(true);

locale.subscribe((lang) => {
    if (lang !== '') {
        if (!get(isLoadingLocale)) {
            isLoadingLocale.set(true);
        }
        import(`../locales/${lang}.json`).then((module) => {
            dictionary.set(module.default);
            if (get(isLoadingInitialLocale)) {
                isLoadingInitialLocale.set(false);
            }
            if (get(isLoadingLocale)) {
                isLoadingLocale.set(false);
            }
        });
    }
});

export const _ = derived(dictionary, ($dictionary) => {
    return (key: string) => {
        const keys = key.split('.');
        let value: string | Dictionary = $dictionary;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key;
            }
        }

        return typeof value === 'string' ? value : key;
    };
});

function getDateFormatter(locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    });
}

export const df = derived(locale, ($locale) => {
    return getDateFormatter($locale === '' ? 'en-US' : $locale);
});
