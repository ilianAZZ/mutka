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

use clipboard::{clipboard_read_files, clipboard_write_files};
use fs_ops::{
    copy_files, create_dir_cmd, create_file, delete_item, get_home_dir, move_files, open_item,
    read_dir, rename_item, write_temp_file,
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
        .expect("error while running mutka explorer");
}
