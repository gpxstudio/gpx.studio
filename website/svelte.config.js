import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
    extensions: ['.mdx'],
};

/** Whether the website is built for the desktop app (`npm run build:desktop`), which only has the app. */
const desktop = process.env.BUILD_TARGET === 'desktop';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    extensions: ['.svelte', ...mdsvexOptions.extensions],
    preprocess: [vitePreprocess({ script: true }), mdsvex(mdsvexOptions)],
    kit: {
        adapter: adapter({
            pages: 'build',
            assets: 'build',
            precompress: false,
            strict: true,
        }),
        paths: {
            base: process.argv.includes('dev') ? '' : process.env.BASE_PATH,
            relative: false,
        },
        prerender: {
            // the desktop app only has the pages of the app, the others are left empty (vite.config.ts)
            crawl: !desktop,
            handleUnseenRoutes: desktop ? 'ignore' : 'fail',
        },
    },
};

export default config;
