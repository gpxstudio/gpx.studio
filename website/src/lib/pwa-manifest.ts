import fs from 'fs';
import { languages } from './languages';

function localizeManifest(manifestTemplateData: any, language: string) {
    const localizedManifestFile = `static/${language}.manifest.webmanifest`;
    const localizedStringsFile = `src/locales/${language}.json`;
    const localizedStrings = JSON.parse(fs.readFileSync(localizedStringsFile, 'utf8'));

    manifestTemplateData.description = localizedStrings.metadata.description;
    manifestTemplateData.lang = language;
    manifestTemplateData.start_url = `/${language}/app`;
    manifestTemplateData.scope = `/${language}/app`;
    manifestTemplateData.id = `https://gpx.studio/${language}/app`;

    fs.writeFileSync(localizedManifestFile, JSON.stringify(manifestTemplateData, null, 2));
}

const manifestTemplateFile = 'static/en.manifest.webmanifest';
const manifestTemplateData = JSON.parse(fs.readFileSync(manifestTemplateFile, 'utf8'));
for (const language of Object.keys(languages)) {
    if (language === 'en') continue;
    localizeManifest(manifestTemplateData, language);
}
