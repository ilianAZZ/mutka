#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

use tauri::Manager;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

// One module per feature/scope. Each declares its own #[tauri::command]s; this
// file only wires them into the Tauri builder. See src-tauri/CLAUDE.md.
mod clipboard;
mod fs_ops;
mod http;
mod icons;
mod launch;
mod modules;
mod mouse_nav;
mod preview;
mod secrets;
mod watcher;
#[cfg(target_os = "macos")]
mod traffic_lights;

use clipboard::{clipboard_read_files, clipboard_write_files};
use fs_ops::{
    cloud_status, copy_files, create_dir_cmd, create_file, delete_item, get_home_dir, move_files,
    open_item, read_dir, read_file_base64, rename_item, write_temp_file,
};
use http::{http_download, http_request, http_upload};
use icons::icon_for_type;
use launch::{apps_for_file, open_with};
use modules::{list_user_modules, read_module_file};
use preview::{preview_update, quick_look};
use secrets::{secret_delete, secret_get, secret_set};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Native OS file drag-out: dragging rows to Finder/another app moves the
        // real files (NSDraggingSession with file URLs), not just their paths.
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, Some(12.0))
                .expect("Failed to apply macOS vibrancy");
            #[cfg(target_os = "macos")]
            {
                mouse_nav::set_app_handle(app.handle().clone());
                unsafe { mouse_nav::setup_mouse_navigation() };

                // Inset the native traffic lights, and re-apply on resize because
                // AppKit re-lays-out the standard buttons whenever the window resizes.
                use cocoa::base::id;
                if let Ok(ns_window) = window.ns_window() {
                    unsafe { traffic_lights::position_traffic_lights(ns_window as id) };
                }
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        if let Ok(ns_window) = win.ns_window() {
                            unsafe { traffic_lights::position_traffic_lights(ns_window as id) };
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_dir,
            copy_files,
            move_files,
            create_file,
            create_dir_cmd,
            rename_item,
            delete_item,
            open_item,
            icon_for_type,
            apps_for_file,
            open_with,
            get_home_dir,
            read_file_base64,
            cloud_status,
            write_temp_file,
            quick_look,
            preview_update,
            http_request,
            http_download,
            http_upload,
            secret_set,
            secret_get,
            secret_delete,
            clipboard_write_files,
            clipboard_read_files,
            list_user_modules,
            read_module_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mutka");
}
