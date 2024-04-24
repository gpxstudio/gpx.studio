export const prerender = true;

import { register, init } from 'svelte-i18n';

register('en', () => import('../locales/en.json'));

init({
    fallbackLocale: 'en',
    initialLocale: 'en',
});