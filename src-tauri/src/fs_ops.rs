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
pub async fn read_dir(app: tauri::AppHandle, path: String, show_hidden: bool) -> Result<Vec<FileItem>, String> {
    // Off the main/IPC thread: a large or slow (cloud/network) directory must
    // never freeze the UI while it is read + stat'd.
    tauri::async_runtime::spawn_blocking(move || read_dir_blocking(app, path, show_hidden))
        .await
        .map_err(|e| e.to_string())?
}

fn read_dir_blocking(app: tauri::AppHandle, path: String, show_hidden: bool) -> Result<Vec<FileItem>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    // Watch the directory we are now showing (re-arms the single live watcher).
    crate::watcher::arm(&app, &path);
    let mut items = Vec::new();

    for entry in entries {
        // Don't silently drop an unreadable entry (e.g. a transient permission
        // error) — log it so a partially-listed folder is diagnosable.
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[read_dir] skipping unreadable entry in {path}: {e}");
                continue;
            }
        };
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

        // Lowercased to match the documented FileItem.extension contract, so
        // openHandlers / icon keys matching "png" also match a "FILE.PNG".
        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase());

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
pub async fn copy_files(paths: Vec<String>, dest: String) -> Result<(), String> {
    // Off the main thread: copying a whole tree byte-by-byte must not freeze the UI.
    tauri::async_runtime::spawn_blocking(move || copy_files_blocking(paths, dest))
        .await
        .map_err(|e| e.to_string())?
}

/// Generate a unique destination path using macOS Finder naming convention:
/// "file.txt" → "file copy.txt" → "file copy 2.txt" → "file copy 3.txt" …
/// Works for both files and directories.
fn make_unique_dest_path(dest_dir: &str, file_name: &str) -> String {
    let candidate = format!("{}/{}", dest_dir, file_name);
    if !std::path::Path::new(&candidate).exists() {
        return candidate;
    }
    let path = std::path::Path::new(file_name);
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let ext = path.extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let copy_path = format!("{}/{} copy{}", dest_dir, stem, ext);
    if !std::path::Path::new(&copy_path).exists() {
        return copy_path;
    }
    let mut n = 2u32;
    loop {
        let n_path = format!("{}/{} copy {}{}", dest_dir, stem, n, ext);
        if !std::path::Path::new(&n_path).exists() {
            return n_path;
        }
        n += 1;
    }
}

fn copy_files_blocking(paths: Vec<String>, dest: String) -> Result<(), String> {
    for src in &paths {
        let src_path = std::path::Path::new(src);
        let file_name = src_path
            .file_name()
            .ok_or("Invalid source path")?
            .to_string_lossy()
            .into_owned();
        let dest_path = make_unique_dest_path(&dest, &file_name);

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
pub async fn move_files(paths: Vec<String>, dest: String) -> Result<(), String> {
    // Off the main thread: a cross-volume move can fall back to a full copy.
    tauri::async_runtime::spawn_blocking(move || move_files_blocking(paths, dest))
        .await
        .map_err(|e| e.to_string())?
}

fn move_files_blocking(paths: Vec<String>, dest: String) -> Result<(), String> {
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
pub async fn delete_item(path: String) -> Result<(), String> {
    // Off the main thread: remove_dir_all on a big tree must not freeze the UI.
    tauri::async_runtime::spawn_blocking(move || delete_item_blocking(path))
        .await
        .map_err(|e| e.to_string())?
}

fn delete_item_blocking(path: String) -> Result<(), String> {
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
    {
        // A bundle (.app, …) is a directory that launches itself — always openable.
        // A regular file with no associated app is reported back so the frontend can
        // offer the "Open With" picker instead of macOS logging kLSApplicationNotFoundErr.
        let is_bundle = std::path::Path::new(&path).is_dir();
        if !is_bundle && !crate::launch::has_opener(&path) {
            return Err(crate::launch::NO_OPENER_ERROR.into());
        }
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
    }
    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    // Open an external link in the user's default browser. A plain
    // <a target="_blank"> does nothing inside a Tauri webview, so the frontend
    // routes external links here. Only http(s) is allowed — never let an
    // arbitrary string reach `open`, which would happily launch file:// paths,
    // app schemes, or local apps.
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http(s) URLs can be opened".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = url;
    }
    Ok(())
}

#[tauri::command]
pub fn get_home_dir() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
}

/// Largest file `read_file_base64` will return, guarding against a module asking
/// for a multi-GB file and exhausting memory. Header-parsing columns (image
/// dimensions, etc.) only need the first few KB anyway.
const MAX_READ_BYTES: u64 = 32 * 1024 * 1024;

/// Read a file's raw bytes, base64-encoded for the IPC bridge. Backs the
/// `fs.readBytes` capability (the frontend gateway decodes it to a Uint8Array).
/// Enables content-reading modules: image metadata, hex preview, .DS_Store, …
#[tauri::command]
pub async fn read_file_base64(path: String) -> Result<String, String> {
    // Off the main thread: reads up to MAX_READ_BYTES into memory and base64-
    // encodes it (~1.33x), so it must not block the UI.
    tauri::async_runtime::spawn_blocking(move || read_file_base64_blocking(path))
        .await
        .map_err(|e| e.to_string())?
}

fn read_file_base64_blocking(path: String) -> Result<String, String> {
    use base64::Engine;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        return Err("Cannot read bytes of a directory".to_string());
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(format!("File too large to read ({} bytes)", meta.len()));
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// Report whether a file is materialized on disk or still cloud-only. Backs the
/// `fs.cloudStatus` capability. Uses the macOS `SF_DATALESS` stat flag, which the
/// File Provider sets on online-only files (iCloud Drive, OneDrive, Dropbox,
/// Google Drive, …); legacy iCloud placeholders (".icloud") are also treated as
/// cloud. Returns "downloaded" | "cloud".
#[tauri::command]
pub fn cloud_status(path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use std::os::macos::fs::MetadataExt;
        // chflags SF_DATALESS — set on a placeholder whose data isn't local yet.
        const SF_DATALESS: u32 = 0x4000_0000;
        let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
        if meta.st_flags() & SF_DATALESS != 0 || path.ends_with(".icloud") {
            return Ok("cloud".to_string());
        }
        Ok("downloaded".to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Ok("downloaded".to_string())
    }
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
    // Confine the write to the temp dir: take ONLY the final path component, so a
    // crafted name like "../../x" can't escape into the user's real filesystem.
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or("Invalid filename")?;
    let staging = std::env::temp_dir().join("mutka-dropped");
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    prune_stale_temp_files(&staging); // best-effort: these accumulate forever otherwise
    let dest = staging.join(safe_name);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

/// Remove files in the staging dir older than 1 hour (a dropped file is consumed
/// — copied/uploaded — immediately after this returns, so anything left over is
/// stale). Best-effort: any error is ignored, this is just housekeeping.
fn prune_stale_temp_files(dir: &std::path::Path) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    let cutoff = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
    for entry in entries.flatten() {
        let stale = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|m| m < cutoff)
            .unwrap_or(false);
        if stale {
            let _ = fs::remove_file(entry.path());
        }
    }
}
