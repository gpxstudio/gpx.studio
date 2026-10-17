//! What the app asks of the system, outside of the files.

use tauri::{AppHandle, Runtime};
use tauri_plugin_opener::OpenerExt;

/// Opens a web page (or an email to write) with the app of the system for it: the links of the
/// page are not followed in the window of the app. Only `http`, `https` and `mailto` addresses are
/// opened.
#[tauri::command(async)]
pub fn open_url<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    let allowed = ["http://", "https://", "mailto:"];
    if !allowed.iter().any(|scheme| url.starts_with(scheme)) {
        return Err(format!("{url} is not a web address"));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| error.to_string())
}
