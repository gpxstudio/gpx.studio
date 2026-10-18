import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';

/** Whether the website is built for the desktop app (`npm run build:desktop`), which only has the app. */
const desktop = process.env.BUILD_TARGET === 'desktop';

/** The pages of the website, which the desktop app opens on gpx.studio: home, help and embed. */
const websitePage = /\/src\/routes\/\[\[language\]\]\/(\+page\.|help\/|embed\/)/;

/** The help guides, which the server imports too (for the titles of the pages). */
const guide = /\/src\/lib\/docs\/.*\.mdx$/;

/**
 * For the desktop app, empties the pages of the website, the help guides and the WebAssembly engine
 * (the app has its own), so that their code, images and the module are not in the build.
 */
function desktopBuild(): Plugin {
    return {
        name: 'desktop-build',
        enforce: 'pre',
        load(id) {
            const path = id.split('?')[0];
            if (websitePage.test(path)) {
                // no entries: the page is not prerendered
                return path.endsWith('.server.ts') ? 'export const entries = () => [];' : '';
            }
            if (guide.test(path)) {
                return "---\ntitle: ''\n---\n";
            }
            if (path.endsWith('/src/lib/engine/backend/wasm.ts')) {
                return `export async function createWasmBackend() {
                    throw new Error('The desktop app has no WebAssembly engine');
                }`;
            }
        },
    };
}

export default defineConfig({
    plugins: [
        ...(desktop ? [desktopBuild()] : []),
        enhancedImages(),
        tailwindcss(),
        wasm(),
        sveltekit(),
    ],
});
