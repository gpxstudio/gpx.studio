export const guides: Record<string, string[]> = {
    'getting-started': [],
    menu: ['file', 'edit', 'view', 'settings'],
    'files-and-stats': [],
    toolbar: ['routing', 'poi', 'scissors', 'time', 'merge', 'extract', 'minify', 'clean'],
    'map-controls': [],
    'gpx': [],
};

export function getPreviousGuide(currentGuide: string): string | undefined {
    let subguides = currentGuide.split('/');

    if (subguides.length === 1) {
        let keys = Object.keys(guides);
        let index = keys.indexOf(currentGuide);
        if (index === 0) {
            return undefined;
        }
        let previousGuide = keys.at(index - 1);
        if (previousGuide === undefined) {
            return undefined;
        } else if (guides[previousGuide].length === 0) {
            return previousGuide;
        } else {
            return `${previousGuide}/${guides[previousGuide][guides[previousGuide].length - 1]}`;
        }
    } else {
        let subguideIndex = guides[subguides[0]].indexOf(subguides[1]);
        if (subguideIndex > 0) {
            return `${subguides[0]}/${guides[subguides[0]][subguideIndex - 1]}`;
        } else {
            return subguides[0];
        }
    }
}

export function getNextGuide(currentGuide: string): string | undefined {
    let subguides = currentGuide.split('/');

    if (subguides.length === 1) {
        if (guides[currentGuide].length === 0) {
            let keys = Object.keys(guides);
            let index = keys.indexOf(currentGuide);
            return keys.at(index + 1);
        } else {
            return `${currentGuide}/${guides[currentGuide][0]}`;
        }
    } else {
        let subguideIndex = guides[subguides[0]].indexOf(subguides[1]);
        if (subguideIndex < guides[subguides[0]].length - 1) {
            return `${subguides[0]}/${guides[subguides[0]][subguideIndex + 1]}`;
        } else {
            let keys = Object.keys(guides);
            let index = keys.indexOf(subguides[0]);
            return keys.at(index + 1);
        }
    }
}