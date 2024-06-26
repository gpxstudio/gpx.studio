import fs from 'fs';
import { languages } from "./languages";

function getURL(lang: string, path: string = '/') {
    return 'https://gpx.studio' + (lang === 'en' ? '' : ('/' + lang)) + path;
}

function generateSitemap() {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +

        Object.keys(languages).map((lang) => `
    <url>
        <loc>${getURL(lang)}</loc>${Object.keys(languages).map((lang2) => `
        <xhtml:link rel="alternate" hreflang="${lang2}" href="${getURL(lang2)}"/>`).join('')}
    </url>`).join('') +

        Object.keys(languages).map((lang) => `
    <url>
        <loc>${getURL(lang, '/about')}</loc>${Object.keys(languages).map((lang2) => `
        <xhtml:link rel="alternate" hreflang="${lang2}" href="${getURL(lang2, '/about')}"/>`).join('')}
    </url>`).join('') +

        `
</urlset>
`;

    return sitemap;
}

fs.writeFileSync('build/sitemap.xml', generateSitemap());