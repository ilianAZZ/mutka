#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

use std::fs;
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg(target_os = "macos")]
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

// Debounce state: the Logitech driver sends a burst of swipe events per button press.
#[cfg(target_os = "macos")]
static LAST_NAV: std::sync::Mutex<Option<std::time::Instant>> = std::sync::Mutex::new(None);

// Intercepts NSEventTypeSwipe (type 31) events before WKWebView sees them.
// macOS mouse drivers (e.g. Logitech Options+) convert back/forward buttons to swipe gestures.
// deltaX < 0 → back, deltaX > 0 → forward.
#[cfg(target_os = "macos")]
unsafe fn setup_mouse_navigation() {
    use block::ConcreteBlock;

    type Id = *mut objc::runtime::Object;

    // NSEventMaskSwipe = 1 << 31
    let mask: u64 = 1 << 31;

    let block = ConcreteBlock::new(|event: Id| -> Id {
        let delta_x: f64 = msg_send![event, deltaX];
        if delta_x == 0.0 {
            return event;
        }

        let now = std::time::Instant::now();
        let mut last = LAST_NAV.lock().unwrap();
        if let Some(t) = *last {
            if now.duration_since(t).as_millis() < 400 {
                return std::ptr::null_mut();
            }
        }
        *last = Some(now);
        drop(last);

        // macOS swipe right (positive deltaX) = go back, left (negative) = go forward
        let dir = if delta_x > 0.0 { "back" } else { "forward" };
        if let Some(handle) = APP_HANDLE.get() {
            let _ = handle.emit("mouse-navigate", dir);
        }

        std::ptr::null_mut()
    });
    let block = block.copy();

    let cls = class!(NSEvent);
    let monitor: Id = msg_send![
        cls,
        addLocalMonitorForEventsMatchingMask: mask
        handler: &*block
    ];
    if !monitor.is_null() {
        let _: () = msg_send![monitor, retain];
    }
    std::mem::forget(block);
}

// ─── NSPasteboard clipboard state ────────────────────────────────────────────
// Tracks the operation (copy/cut) we last wrote, and the pasteboard change count
// at that write. If the change count differs when reading, another app (e.g. Finder)
// wrote to the pasteboard in the meantime — we treat that as a copy.

#[cfg(target_os = "macos")]
static CLIPBOARD_OPERATION: Mutex<Option<String>> = Mutex::new(None);
#[cfg(target_os = "macos")]
static CLIPBOARD_CHANGE_COUNT: Mutex<i64> = Mutex::new(-1);

// Return type for clipboard_read_files — matches ClipboardReadResult in TypeScript
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardReadResult {
    pub paths: Vec<String>,
    pub operation: String,
}

// Writes file URLs to the system NSPasteboard using NSURL objects.
// Returns the pasteboard change count after writing.
#[cfg(target_os = "macos")]
unsafe fn pasteboard_write(paths: &[String]) -> Result<i64, String> {
    use std::ffi::CString;
    type Id = *mut objc::runtime::Object;

    let pb: Id = msg_send![class!(NSPasteboard), generalPasteboard];
    let _: i64 = msg_send![pb, clearContents];

    let arr: Id = msg_send![class!(NSMutableArray), new];
    for path in paths {
        let c = CString::new(path.as_str()).map_err(|e| e.to_string())?;
        let ns_str: Id = msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()];
        let ns_url: Id = msg_send![class!(NSURL), fileURLWithPath: ns_str];
        let _: () = msg_send![arr, addObject: ns_url];
    }

    if !paths.is_empty() {
        let ok: bool = msg_send![pb, writeObjects: arr];
        if !ok {
            return Err("NSPasteboard writeObjects: failed".into());
        }
    }

    let count: i64 = msg_send![pb, changeCount];
    Ok(count)
}

// Reads file URLs from the system NSPasteboard.
// Returns (file paths, current change count).
#[cfg(target_os = "macos")]
unsafe fn pasteboard_read() -> Result<(Vec<String>, i64), String> {
    use std::ffi::CStr;
    type Id = *mut objc::runtime::Object;

    let pb: Id = msg_send![class!(NSPasteboard), generalPasteboard];
    let current_count: i64 = msg_send![pb, changeCount];

    // readObjectsForClasses: expects NSArray<Class>.
    // class!(NSURL) returns &Class; send `class` to it to get an id-compatible pointer.
    let nsurl_cls_id: Id = msg_send![class!(NSURL), class];
    let classes: Id = msg_send![class!(NSArray), arrayWithObject: nsurl_cls_id];
    let items: Id = msg_send![pb, readObjectsForClasses: classes
                                              options: std::ptr::null::<objc::runtime::Object>()];

    if items.is_null() {
        return Ok((vec![], current_count));
    }

    let n: usize = msg_send![items, count];
    let mut paths = Vec::with_capacity(n);

    for i in 0usize..n {
        let url: Id = msg_send![items, objectAtIndex: i];
        let ns_path: Id = msg_send![url, path];
        if ns_path.is_null() { continue; }
        let c_str: *const i8 = msg_send![ns_path, UTF8String];
        if c_str.is_null() { continue; }
        paths.push(CStr::from_ptr(c_str).to_string_lossy().to_string());
    }

    Ok((paths, current_count))
}

/// Write file paths + operation to the system clipboard (NSPasteboard).
/// Files written this way can be pasted in Finder. Operation is tracked
/// separately since NSPasteboard has no native concept of copy vs. cut.
#[tauri::command]
fn clipboard_write_files(paths: Vec<String>, operation: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    unsafe {
        let change_count = pasteboard_write(&paths)?;
        *CLIPBOARD_OPERATION.lock().map_err(|e| e.to_string())? = Some(operation);
        *CLIPBOARD_CHANGE_COUNT.lock().map_err(|e| e.to_string())? = change_count;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (paths, operation);
    Ok(())
}

/// Read file paths from the system clipboard (NSPasteboard).
/// Returns None when the clipboard is empty or contains no files.
/// If another app (e.g. Finder) wrote to the clipboard, operation is "copy".
#[tauri::command]
fn clipboard_read_files() -> Result<Option<ClipboardReadResult>, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        let (paths, current_count) = pasteboard_read()?;
        if paths.is_empty() {
            return Ok(None);
        }
        let our_count = *CLIPBOARD_CHANGE_COUNT.lock().map_err(|e| e.to_string())?;
        let operation = if current_count == our_count {
            CLIPBOARD_OPERATION.lock().map_err(|e| e.to_string())?
                .clone()
                .unwrap_or_else(|| "copy".to_string())
        } else {
            "copy".to_string() // written by another app — treat as copy
        };
        return Ok(Some(ClipboardReadResult { paths, operation }));
    }
    #[cfg(not(target_os = "macos"))]
    Ok(None)
}

// camelCase so TypeScript receives isDir, not is_dir
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub extension: Option<String>,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<FileItem>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut items = Vec::new();

    for entry in entries.flatten() {
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        let modified = meta
            .modified()
            .unwrap_or(UNIX_EPOCH)
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_string());

        items.push(FileItem {
            name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: meta.len(),
            modified,
            extension,
        });
    }

    items.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(items)
}

#[tauri::command]
fn copy_files(paths: Vec<String>, dest: String) -> Result<(), String> {
    for src in &paths {
        let src_path = std::path::Path::new(src);
        let file_name = src_path
            .file_name()
            .ok_or("Invalid source path")?
            .to_string_lossy();
        let dest_path = format!("{}/{}", dest, file_name);

        if src_path.is_dir() {
            copy_dir_all(src_path, &dest_path).map_err(|e| e.to_string())?;
        } else {
            fs::copy(src, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn copy_dir_all(src: &std::path::Path, dest: &str) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let child_dest = format!("{}/{}", dest, entry.file_name().to_string_lossy());
        if entry.metadata()?.is_dir() {
            copy_dir_all(&entry.path(), &child_dest)?;
        } else {
            fs::copy(entry.path(), child_dest)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn move_files(paths: Vec<String>, dest: String) -> Result<(), String> {
    for src in &paths {
        let file_name = std::path::Path::new(src)
            .file_name()
            .ok_or("Invalid source path")?
            .to_string_lossy();
        let dest_path = format!("{}/{}", dest, file_name);
        fs::rename(src, &dest_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    fs::File::create(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_dir_cmd(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn rename_item(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_item(path: String) -> Result<(), String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_item(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_home_dir() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
}

fn modules_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    std::path::PathBuf::from(home).join(".macows").join("modules")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserModuleEntry {
    pub id: String,
    pub entry_path: String,
}

/// List community modules installed in ~/.macows/modules/.
/// Returns one entry per subdirectory that contains an index.js.
/// Returns an empty list (not an error) if the directory doesn't exist yet.
#[tauri::command]
fn list_user_modules() -> Result<Vec<UserModuleEntry>, String> {
    let dir_path = modules_dir();
    let dir = match fs::read_dir(&dir_path) {
        Ok(d) => d,
        Err(_) => return Ok(vec![]),
    };

    let mut entries: Vec<UserModuleEntry> = dir
        .flatten()
        .filter(|e| e.metadata().map(|m| m.is_dir()).unwrap_or(false))
        .filter_map(|e| {
            let entry_path = e.path().join("index.js");
            if entry_path.exists() {
                Some(UserModuleEntry {
                    id: e.file_name().to_string_lossy().to_string(),
                    entry_path: entry_path.to_string_lossy().to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    entries.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(entries)
}

/// Read a community module file as a UTF-8 string.
/// Restricted to ~/.macows/modules/ — returns an error for any other path.
#[tauri::command]
fn read_module_file(path: String) -> Result<String, String> {
    let allowed = modules_dir().to_string_lossy().to_string();
    if !path.starts_with(&allowed) {
        return Err(format!("Access denied: {} is outside ~/.macows/modules", path));
    }
    fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {}", path, e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, Some(12.0))
                .expect("Failed to apply macOS vibrancy");
            #[cfg(target_os = "macos")]
            {
                APP_HANDLE.set(app.handle().clone()).ok();
                unsafe { setup_mouse_navigation() };
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
            get_home_dir,
            clipboard_write_files,
            clipboard_read_files,
            list_user_modules,
            read_module_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running macows explorer");
}
