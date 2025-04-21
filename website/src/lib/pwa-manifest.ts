import fs from 'fs';
import { languages } from '$lib/languages';

function localizeManifest(manifestTemplateData: any, language: string) {
    const localizedManifestFile = `static/${language}.manifest.webmanifest`;
    const localizedStringsFile = `src/locales/${language}.json`;
    const localizedStrings = JSON.parse(fs.readFileSync(localizedStringsFile, 'utf8'));

    manifestTemplateData.description = localizedStrings.metadata.description;
    manifestTemplateData.lang = language;

    fs.writeFileSync(localizedManifestFile, JSON.stringify(manifestTemplateData, null, 2));
}

for (const language of Object.keys(languages)) {
    const manifestTemplateFile = 'static/en.manifest.webmanifest';
    const manifestTemplateData = JSON.parse(fs.readFileSync(manifestTemplateFile, 'utf8'));
    localizeManifest(manifestTemplateData, language);
}
