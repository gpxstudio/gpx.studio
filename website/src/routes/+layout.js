export const prerender = true;
export const ssr = false;

import { languages } from '$lib/languages';
import { register, init } from 'svelte-i18n';

Object.keys(languages).forEach((lang) => {
    register(lang, () => import(`../locales/${lang}.json`));
});

init({
    fallbackLocale: 'en',
    initialLocale: 'en',
});