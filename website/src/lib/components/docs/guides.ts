// The guides of the help section, and how they follow one another. The icons are in `docs.ts`.

export const guides: Record<string, string[]> = {
    'getting-started': [],
    menu: ['file', 'edit', 'view', 'settings'],
    'files-and-stats': [],
    toolbar: [
        'routing',
        'poi',
        'scissors',
        'time',
        'merge',
        'extract',
        'elevation',
        'minify',
        'clean',
    ],
    'map-controls': [],
    gpx: [],
    integration: [],
    faq: [],
};

export function getPreviousGuide(currentGuide: string): string | undefined {
    const subguides = currentGuide.split('/');

    if (subguides.length === 1) {
        const keys = Object.keys(guides);
        const index = keys.indexOf(currentGuide);
        if (index === 0) {
            return undefined;
        }
        const previousGuide = keys[index - 1];
        if (previousGuide === undefined) {
            return undefined;
        } else if (guides[previousGuide].length === 0) {
            return previousGuide;
        } else {
            return `${previousGuide}/${guides[previousGuide][guides[previousGuide].length - 1]}`;
        }
    } else {
        if (guides.hasOwnProperty(subguides[0])) {
            const subguideIndex = guides[subguides[0]].indexOf(subguides[1]);
            if (subguideIndex > 0) {
                return `${subguides[0]}/${guides[subguides[0]][subguideIndex - 1]}`;
            } else {
                return subguides[0];
            }
        } else {
            return undefined;
        }
    }
}

export function getNextGuide(currentGuide: string): string | undefined {
    const subguides = currentGuide.split('/');

    if (subguides.length === 1) {
        if (guides.hasOwnProperty(currentGuide)) {
            if (guides[currentGuide].length === 0) {
                const keys = Object.keys(guides);
                const index = keys.indexOf(currentGuide);
                return keys[index + 1];
            } else {
                return `${currentGuide}/${guides[currentGuide][0]}`;
            }
        } else {
            return undefined;
        }
    } else {
        if (guides.hasOwnProperty(subguides[0])) {
            const subguideIndex = guides[subguides[0]].indexOf(subguides[1]);
            if (subguideIndex < guides[subguides[0]].length - 1) {
                return `${subguides[0]}/${guides[subguides[0]][subguideIndex + 1]}`;
            } else {
                const keys = Object.keys(guides);
                const index = keys.indexOf(subguides[0]);
                return keys[index + 1];
            }
        } else {
            return undefined;
        }
    }
}
