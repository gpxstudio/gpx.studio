import { engine } from '$lib/engine';

/** Where the pages of the website are, for the links of the desktop app to them. */
const website = 'https://gpx.studio';

let installed = false;

/** The address to open in the browser for a link: the pages of the website are on the website. */
function browserURL(href: string): string {
    const url = new URL(href, location.href);
    return url.origin === location.origin
        ? `${website}${url.pathname}${url.search}${url.hash}`
        : url.href;
}

/**
 * Opens the links that leave the app in the browser of the system, as the window of the desktop app
 * does not follow them: the external links, the links that open a new tab (the pages of the
 * website, like the help), and what `window.open` is given. The other links are pages of the app.
 * It is done once, for as long as the window is open.
 */
export function openLinksInBrowser() {
    if (installed) {
        return;
    }
    installed = true;
    const onClick = (e: MouseEvent) => {
        // the main button, or the middle one which opens a new tab
        if (e.button > 1) {
            return;
        }
        const link = (e.target as Element | null)?.closest?.('a[href]');
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }
        const url = new URL(link.href, location.href);
        if (url.origin === location.origin && link.target !== '_blank' && e.button === 0) {
            return;
        }
        e.preventDefault();
        engine.openUrl(browserURL(link.href));
    };
    window.open = (url?: string | URL) => {
        if (url !== undefined) {
            engine.openUrl(browserURL(String(url)));
        }
        return null;
    };
    // before the router of the app, which would follow the link
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
}
