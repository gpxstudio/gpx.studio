import fs from 'fs';
import { glob } from 'glob';
import { languages } from '$lib/languages';

function generateSitemap() {
    const pages = glob.sync('**/*.html', { cwd: 'build' });

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    pages.forEach((page) => {
        const url = page.replace('.html', '').replace('index', '');

        const rootDir = url.split('/')[0];
        if (languages[url] || languages[rootDir]) {
            // Skip localized pages
            return;
        }

        Object.keys(languages).forEach((language) => {
            sitemap += `<url>\n`;
            sitemap += `  <loc>https://gpx.studio/${language === 'en' ? '' : language + '/'}${url}</loc>\n`;

            Object.keys(languages).forEach((alternate) => {
                if (alternate === language) return;

                sitemap += `  <xhtml:link rel="alternate" hreflang="${alternate}" href="https://gpx.studio/${alternate === 'en' ? '' : alternate + '/'}${url}" />\n`;
            });

            sitemap += `</url>\n`;
        });
    });

    sitemap += '</urlset>';

    return sitemap;
}

fs.writeFileSync('build/sitemap.xml', generateSitemap());