export const prerender = true;

import { languages } from '$lib/languages';
import { register, init } from 'svelte-i18n';

Object.keys(languages).forEach((lang) => {
    register(lang, () => import(`../locales/${lang}.json`));
});

init({
    fallbackLocale: 'en',
    initialLocale: 'en',
});