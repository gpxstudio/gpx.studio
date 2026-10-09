// Resolves the virtual modules of SvelteKit to stubs, so that the code that imports them can be
// tested outside of the framework.
import { fileURLToPath, pathToFileURL } from 'node:url';

const stubs = {
    '$app/environment': 'app-environment.ts',
    '$app/paths': 'app-paths.ts',
    '$app/state': 'app-state.ts',
    '$env/static/public': 'env-static-public.ts',
};

export async function resolve(specifier, context, nextResolve) {
    const stub = stubs[specifier];
    if (stub) {
        const url = pathToFileURL(fileURLToPath(new URL(`./stubs/${stub}`, import.meta.url)));
        return nextResolve(url.href, context);
    }
    return nextResolve(specifier, context);
}

// Stylesheets are for the browser: importing one gives nothing.
export async function load(url, context, nextLoad) {
    if (url.endsWith('.css')) {
        return { format: 'module', source: '', shortCircuit: true };
    }
    return nextLoad(url, context);
}
