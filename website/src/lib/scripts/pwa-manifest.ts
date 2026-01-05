import fs from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { languages } from '../languages';

dotenvConfig();

const basePath = process.env.BASE_PATH || '';

function localizeManifest(manifestTemplateData: any, language: string) {
    const localizedManifestFile = `static/${language}.manifest.webmanifest`;
    const localizedStringsFile = `src/locales/${language}.json`;
    const localizedStrings = JSON.parse(fs.readFileSync(localizedStringsFile, 'utf8'));

    manifestTemplateData.description = localizedStrings.metadata.description;
    manifestTemplateData.lang = language;
    manifestTemplateData.start_url = `${basePath}/${language}/app`;
    manifestTemplateData.scope = `${basePath}/${language}/app`;
    manifestTemplateData.id = `https://gpx.studio${basePath}/${language}/app`;

    fs.writeFileSync(localizedManifestFile, JSON.stringify(manifestTemplateData, null, 2));
}

const manifestTemplateFile = 'static/en.manifest.webmanifest';
const manifestTemplateData = JSON.parse(fs.readFileSync(manifestTemplateFile, 'utf8'));
for (const language of Object.keys(languages)) {
    if (language === 'en') continue;
    localizeManifest(manifestTemplateData, language);
}
