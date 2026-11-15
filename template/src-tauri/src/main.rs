// __NAME__ on Windows and Linux: the same files as the web app and the phone
// apps (tools/build-www.js), in the system's own WebView. Everything the app
// does lives in src/; this only opens the window and keeps one copy running.
// keel's platform.js finds it through window.__TAURI__ (withGlobalTauri).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // First, so a second launch brings the running window back instead
        // of opening another copy beside it.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        // Links to other sites open in the browser (keel's platform.js).
        .plugin(tauri_plugin_opener::init())
        // Updates from the release's latest.json, once the updater key is set
        // (README.md, "The desktop app").
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("__NAME__ failed to start");
}
