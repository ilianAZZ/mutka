// ─── File system operations ──────────────────────────────────────────────────
// Directory listing plus the basic file mutations (copy, move, create, rename,
// delete, open). All stateless — state lives in the frontend.

use std::fs;
use std::time::UNIX_EPOCH;
use serde::{Deserialize, Serialize};

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
    /// True for dotfiles (name starts with '.'). The UI dims these like Finder.
    pub is_hidden: bool,
    /// True if this entry is a symbolic link. is_dir/size/modified reflect the
    /// link's TARGET (we follow it) so a link to a folder navigates in-app.
    pub is_symlink: bool,
    /// True if this directory is a macOS package/bundle (.app, .bundle, …). The
    /// UI launches it like a file and shows its real icon instead of navigating.
    pub is_package: bool,
    /// True if this directory carries a custom Finder icon (an "Icon\r" file).
    /// Such a folder is still navigable but should show its real icon, not the
    /// generic folder icon (e.g. the "Adobe Acrobat" folder in /Applications).
    pub has_custom_icon: bool,
}

/// Directory extensions macOS treats as one opaque package/bundle. Detected by
/// extension (instant) rather than NSWorkspace isFilePackageAtPath: — the latter
/// queries Launch Services per item and made read_dir freeze on big folders.
const PACKAGE_EXTENSIONS: &[&str] = &[
    "app", "bundle", "framework", "plugin", "kext", "prefpane", "qlgenerator",
    "mdimporter", "component", "saver", "wdgt", "appex", "xpc", "dext",
    "systemextension", "photoslibrary", "tvlibrary", "rtfd", "pages", "numbers",
    "key", "scptd", "sparsebundle", "fcpbundle",
];

fn is_package_extension(extension: &Option<String>) -> bool {
    match extension {
        Some(e) => PACKAGE_EXTENSIONS.contains(&e.to_lowercase().as_str()),
        None => false,
    }
}

#[tauri::command]
pub fn read_dir(path: String, show_hidden: bool) -> Result<Vec<FileItem>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut items = Vec::new();

    for entry in entries.flatten() {
        let entry_path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        let is_hidden = name.starts_with('.');
        if is_hidden && !show_hidden {
            continue;
        }

        // entry.metadata() does NOT follow symlinks. To make a link-to-folder
        // navigate in-app, resolve the target via fs::metadata (which follows),
        // falling back to the link's own metadata when the target is broken.
        let is_symlink = entry.file_type().map(|t| t.is_symlink()).unwrap_or(false);
        let meta = match fs::metadata(&entry_path).or_else(|_| entry.metadata()) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let modified = meta
            .modified()
            .unwrap_or(UNIX_EPOCH)
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_string());

        let path_str = entry_path.to_string_lossy().to_string();
        let is_dir = meta.is_dir();
        // A "package" is a directory macOS treats as one opaque item: .app, .bundle,
        // .framework, .photoslibrary, etc. The UI launches it (not navigate into it)
        // and shows its real icon. Detected by extension — fast, no syscall.
        let is_package = is_dir && is_package_extension(&extension);
        // A plain folder with a custom Finder icon stores it in an "Icon\r" file.
        // One cheap stat lets the UI show that icon instead of the generic folder.
        let has_custom_icon = is_dir && !is_package && entry_path.join("Icon\r").exists();

        items.push(FileItem {
            name,
            path: path_str,
            is_dir,
            size: meta.len(),
            modified,
            extension,
            is_hidden,
            is_symlink,
            is_package,
            has_custom_icon,
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
pub fn copy_files(paths: Vec<String>, dest: String) -> Result<(), String> {
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
pub fn move_files(paths: Vec<String>, dest: String) -> Result<(), String> {
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
pub fn create_file(path: String) -> Result<(), String> {
    fs::File::create(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_dir_cmd(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_item(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_item(path: String) -> Result<(), String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_item(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_home_dir() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
}

/// Write base64-encoded bytes (a file dropped from Finder) to a temp file and
/// return its path. The caller then copy/move-routes that local path like any
/// other (local copy, or upload to a provider).
#[tauri::command]
pub fn write_temp_file(filename: String, content_base64: String) -> Result<String, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content_base64.as_bytes())
        .map_err(|e| e.to_string())?;
    let dest = std::env::temp_dir().join("macows-dropped").join(&filename);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}
