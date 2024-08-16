import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
    extensions: ['.mdx']
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
    extensions: ['.svelte', ...mdsvexOptions.extensions],
    preprocess: [vitePreprocess(), mdsvex(mdsvexOptions)],
    kit: {
        adapter: adapter({
            pages: 'build',
            assets: 'build',
            precompress: false,
            strict: true
        }),
        paths: {
            base: process.argv.includes('dev') ? '' : process.env.BASE_PATH,
            relative: false,
        },
        prerender: {
            entries: ['/', '/404'],
            crawl: true,
        }
    }
};

export default config;
