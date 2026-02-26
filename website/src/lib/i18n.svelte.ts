type Dictionary = {
    [key: string]: string | Dictionary;
};

function getDateFormatter(locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    });
}

const localeLoaders = import.meta.glob('../locales/*.json');

class Locale {
    private _lang = $state('');
    private _isLoadingInitial = $state(true);
    private _isLoading = $state(true);
    private dictionary: Dictionary = $state({});
    private _t = $derived((key: string, fallback?: string) => {
        const keys = key.split('.');
        let value: string | Dictionary = this.dictionary;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return fallback || key;
            }
        }

        return typeof value === 'string' ? value : key;
    });
    private _df = $derived(getDateFormatter(this._lang === '' ? 'en' : this._lang));

    public set lang(lang: string) {
        this._lang = lang;
        if (this._lang !== '') {
            if (!this._isLoading) {
                this._isLoading = true;
            }
            const localePath = `../locales/${this._lang}.json`;
            const loadLocale = localeLoaders[localePath];

            if (!loadLocale) {
                console.error(`Missing locale file for language: ${this._lang}`);
                if (this._isLoadingInitial) {
                    this._isLoadingInitial = false;
                }
                if (this._isLoading) {
                    this._isLoading = false;
                }
                return;
            }

            loadLocale()
                .then((module) => {
                    this.dictionary = (module as { default: Dictionary }).default;
                })
                .catch((error) => {
                    console.error(`Failed to load locale: ${this._lang}`, error);
                })
                .finally(() => {
                    if (this._isLoadingInitial) {
                        this._isLoadingInitial = false;
                    }
                    if (this._isLoading) {
                        this._isLoading = false;
                    }
                });
        }
    }

    public get lang() {
        return this._lang;
    }

    public get isLoading() {
        return this._isLoading;
    }

    public get isLoadingInitial() {
        return this._isLoadingInitial;
    }

    public get _() {
        return this._t;
    }

    public get df() {
        return this._df;
    }
}

export const i18n = new Locale();
