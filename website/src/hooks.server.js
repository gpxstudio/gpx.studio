import { base } from '$app/paths';
import { languages } from '$lib/languages';
import { getURLForLanguage } from '$lib/utils';

export async function handle({ event, resolve }) {
    let language = event.params.language ?? 'en';
    const strings = await import(`./locales/${language}.json`);

    let path = event.url.pathname;
    let page = event.route.id?.replace('/[[language]]', '').split('/')[1] ?? 'home';

    let title = strings.metadata[`${page}_title`];
    let description = strings.metadata[`description`];

    let htmlTag = `<html lang="${language}" translate="no">`;

    let headTag = `<head>
    <title>gpx.studio — ${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="gpx.studio — ${title}" />
    <meta property="og:description" content="${description}" />
    <meta name="twitter:title" content="gpx.studio — ${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta property="og:image" content="https://gpx.studio${base}/og_logo.png" />
    <meta property="og:url" content="https://gpx.studio/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="gpx.studio" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="https://gpx.studio${base}/og_logo.png" />
    <meta name="twitter:url" content="https://gpx.studio/" />
    <meta name="twitter:site" content="@gpxstudio" />
    <meta name="twitter:creator" content="@gpxstudio" />
    <link rel="alternate" hreflang="x-default" href="https://gpx.studio${getURLForLanguage('en', path)}" />`;

    for (let lang of Object.keys(languages)) {
        headTag += `   <link rel="alternate" hreflang="${lang}" href="https://gpx.studio${getURLForLanguage(lang, path)}" />
`;
    }

    let stringsHTML = stringsToHTML(strings);

    const response = await resolve(event, {
        transformPageChunk: ({ html }) => html.replace('<html>', htmlTag).replace('<head>', headTag).replace('<body data-sveltekit-preload-data="hover">', `<body data-sveltekit-preload-data="hover"><div class="hidden">${stringsHTML}</div>`)
    });

    return response;
}

function stringsToHTML(dictionary, strings = new Set(), root = true) {
    Object.values(dictionary).forEach((value) => {
        if (typeof value === 'object') {
            stringsToHTML(value, strings, false);
        } else {
            strings.add(value);
        }
    });
    if (root) {
        return Array.from(strings).map((string) => `<p>${string}</p>`).join('');
    }
}