import { BundleType, getBundleType, getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { toast } from 'svelte-sonner';
import { engine } from '$lib/engine';
import { i18n } from '$lib/i18n/i18n.svelte';

/** Where the `.deb` and `.rpm` packages can be downloaded, as they do not update themselves. */
const releases = 'https://github.com/gpxstudio/gpx.studio/releases/latest';

/**
 * Offers the update, if there is one. The app does not restart by itself, as it would interrupt
 * the user. The beta versions are not updated, as they would be replaced by the stable release.
 */
export async function checkForUpdates() {
    if (import.meta.env.DEV || (await getVersion()).includes('-')) {
        return;
    }
    const update = await check().catch((error) => {
        // most likely offline: it will be checked again the next time the app starts
        console.warn('Could not check for updates', error);
        return null;
    });
    if (update === null) {
        return;
    }

    const message = i18n._('desktop.update_available').replace('{version}', update.version);
    const bundle = await getBundleType();
    if (bundle === BundleType.Deb || bundle === BundleType.Rpm) {
        toast.info(message, {
            duration: Number.POSITIVE_INFINITY,
            action: {
                label: i18n._('desktop.update_download'),
                onClick: () => engine.openUrl(releases),
            },
        });
    } else {
        toast.info(message, {
            duration: Number.POSITIVE_INFINITY,
            action: {
                label: i18n._('desktop.update_restart'),
                onClick: () => install(update),
            },
        });
    }
}

async function install(update: Update) {
    const installing = toast.loading(i18n._('desktop.update_installing'));
    try {
        await update.downloadAndInstall();
        await relaunch();
    } catch (error) {
        console.error('Could not install the update', error);
        toast.error(i18n._('desktop.update_failed'), { id: installing });
    }
}
