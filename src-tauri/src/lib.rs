#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

use tauri::{Emitter, Manager};
use tauri_plugin_cli::CliExt;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

// One module per feature/scope. Each declares its own #[tauri::command]s; this
// file only wires them into the Tauri builder. See src-tauri/CLAUDE.md.
mod app_info;
mod cli;
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

use app_info::get_app_version;
use cli::{cli_exit, cli_output, get_cli_args, CliArgs};
use clipboard::{clipboard_read_files, clipboard_write_files};
use fs_ops::{
    cloud_status, copy_files, create_dir_cmd, create_file, delete_item, get_home_dir, move_files,
    open_item, open_url, read_dir, read_file_base64, rename_item, write_temp_file,
};
use http::http_request;
use icons::{icons_for_types, preload_icon_cache};
use launch::{apps_for_file, open_with};
use modules::{
    install_module, list_user_modules, read_module_config, read_module_file, uninstall_module,
    write_module_config,
};
use preview::{preview_update, quick_look};
use secrets::{secret_delete, secret_get, secret_set};

/// Parse CLI matches into a typed struct for the frontend.
fn parse_cli_args(matches: &tauri_plugin_cli::Matches) -> CliArgs {
    let path = matches
        .args
        .get("path")
        .and_then(|v| v.value.as_str().map(String::from))
        .map(|p| {
            std::fs::canonicalize(&p)
                .map(|abs| abs.to_string_lossy().into_owned())
                .unwrap_or(p)
        });
    let picker = matches
        .args
        .get("picker")
        .map(|v| v.occurrences > 0)
        .unwrap_or(false);
    let run = matches
        .args
        .get("run")
        .and_then(|v| v.value.as_str().map(String::from));
    let list_actions = matches
        .args
        .get("list-actions")
        .map(|v| v.occurrences > 0)
        .unwrap_or(false);
    CliArgs {
        path,
        picker,
        run,
        list_actions,
    }
}

/// Usage text printed by `mutka --help` / `mutka -h`.
const HELP: &str = "\
Mutka — community-driven file explorer for macOS

USAGE:
    mutka [PATH]
    mutka [OPTIONS]

ARGS:
    <PATH>              Directory to open

OPTIONS:
    -P, --picker        Open the file picker and print the selected path to stdout
    -r, --run <ACTION>  Run a module action by ID (e.g. core.clipboard.copy)
        --list-actions  List all registered module actions and exit
    -h, --help          Show this help and exit
";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `--help` is static text — print it and exit before touching Tauri or the webview.
    if std::env::args().any(|a| a == "--help" || a == "-h") {
        print!("{HELP}");
        return;
    }

    // `--list-actions` / `--run` are one-shot CLI commands: they must print to the
    // terminal that launched them and exit. Skip single-instance so they run as their
    // own short-lived (hidden) process instead of forwarding to a GUI on a dead stdout.
    let cli_mode = std::env::args().any(|a| a == "--list-actions" || a == "--run" || a == "-r");

    let mut builder = tauri::Builder::default()
        // Native OS file drag-out: dragging rows to Finder/another app moves the
        // real files (NSDraggingSession with file URLs), not just their paths.
        .plugin(tauri_plugin_drag::init())
        // In-app updater (+ process for relaunch). The frontend checks for a
        // newer release on launch and prompts before downloading. See src/update.ts.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // CLI argument parsing (mutka <path>, --picker, --run <action>).
        .plugin(tauri_plugin_cli::init());

    if !cli_mode {
        // Forward CLI args to the running instance instead of spawning a second one.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            // Re-parse the forwarded argv and emit to the frontend.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                // Resolve positional path args relative to the second instance's cwd so
                // that `mutka .` forwarded from another terminal window gets the right path.
                let mut resolved: Vec<String> = Vec::with_capacity(argv.len().saturating_sub(1));
                let mut skip_next = false;
                for a in &argv[1..] {
                    if skip_next {
                        skip_next = false;
                        resolved.push(a.clone());
                        continue;
                    }
                    if a == "--run" {
                        skip_next = true;
                        resolved.push(a.clone());
                        continue;
                    }
                    if a.starts_with('-') {
                        resolved.push(a.clone());
                        continue;
                    }
                    // Positional arg — resolve as path relative to forwarding process's cwd.
                    let p = std::path::Path::new(a.as_str());
                    let full = if p.is_absolute() { p.to_path_buf() } else { std::path::Path::new(&cwd).join(p) };
                    resolved.push(
                        std::fs::canonicalize(&full)
                            .map(|abs| abs.to_string_lossy().into_owned())
                            .unwrap_or_else(|_| a.clone()),
                    );
                }
                let _ = window.emit("cli:forwarded-args", &resolved);
            }
        }));
    }

    builder
        .setup(|app| {
            // Parse CLI args and store them so the frontend can retrieve them.
            let cli_args = match app.cli().matches() {
                Ok(matches) => parse_cli_args(&matches),
                Err(_) => CliArgs {
                    path: None,
                    picker: false,
                    run: None,
                    list_actions: false,
                },
            };
            // `--list-actions` / `--run` do their work in the webview (the action
            // registry lives in JS) then exit — keep the window hidden so no GUI flashes.
            let headless = cli_args.list_actions || cli_args.run.is_some();
            app.manage(cli_args);

            let window = app.get_webview_window("main").unwrap();
            if headless {
                let _ = window.hide();
            }
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, Some(12.0))
                .expect("Failed to apply macOS vibrancy");
            #[cfg(target_os = "macos")]
            {
                mouse_nav::set_app_handle(app.handle().clone());
                unsafe { mouse_nav::setup_mouse_navigation() };

                // Inset the native traffic lights, and re-apply on resize because
                // AppKit re-lays-out the standard buttons whenever the window resizes.
                // ns_window() hands back a void*; traffic_lights wants an NSWindow*.
                type Id = *mut objc::runtime::Object;
                if let Ok(ns_window) = window.ns_window() {
                    unsafe { traffic_lights::position_traffic_lights(ns_window as Id) };
                }
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        if let Ok(ns_window) = win.ns_window() {
                            unsafe { traffic_lights::position_traffic_lights(ns_window as Id) };
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
            open_url,
            icons_for_types,
            preload_icon_cache,
            apps_for_file,
            open_with,
            get_home_dir,
            get_app_version,
            read_file_base64,
            cloud_status,
            write_temp_file,
            quick_look,
            preview_update,
            http_request,
            secret_set,
            secret_get,
            secret_delete,
            clipboard_write_files,
            clipboard_read_files,
            list_user_modules,
            read_module_file,
            install_module,
            uninstall_module,
            read_module_config,
            write_module_config,
            get_cli_args,
            cli_output,
            cli_exit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mutka");
}
