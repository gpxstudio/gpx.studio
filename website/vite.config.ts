import { sveltekit } from '@sveltejs/kit/vite';
import { enhancedImages } from '@sveltejs/enhanced-img';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
    ssr: {
        noExternal: ['gpx'],
    },
    plugins: [enhancedImages(), tailwindcss(), wasm(), sveltekit()],
});
