// ─── Community module discovery ──────────────────────────────────────────────
// Lists and reads community modules installed in ~/.mutka/modules/. Reads are
// restricted to that directory so a module can never be loaded from elsewhere.

use std::fs;
use serde::Serialize;

fn modules_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    std::path::PathBuf::from(home).join(".mutka").join("modules")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserModuleEntry {
    pub id: String,
    pub entry_path: String,
}

/// List community modules installed in ~/.mutka/modules/.
/// Returns one entry per subdirectory that contains an index.js.
/// Returns an empty list (not an error) if the directory doesn't exist yet.
#[tauri::command]
pub fn list_user_modules() -> Result<Vec<UserModuleEntry>, String> {
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
/// Restricted to ~/.mutka/modules/ — returns an error for any other path.
#[tauri::command]
pub fn read_module_file(path: String) -> Result<String, String> {
    let allowed = modules_dir().to_string_lossy().to_string();
    if !path.starts_with(&allowed) {
        return Err(format!("Access denied: {} is outside ~/.mutka/modules", path));
    }
    fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {}", path, e))
}

// ─── Install / uninstall ──────────────────────────────────────────────────────
// Writing happens ONLY under ~/.mutka/modules/<id>/. The module id is the folder
// name, so it must be a safe single path segment — no separators, no "..", no
// leading dot. The frontend has already downloaded + validated the source (loads
// in a throwaway worker) before calling this; Rust only persists the bytes.

/// Reject anything that isn't a safe single folder name (used as the module id).
fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && !id.starts_with('.')
        && id.len() <= 200
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
        && !id.contains("..")
}

/// Write a validated module's source to ~/.mutka/modules/<id>/index.js.
/// Creates the directory (and ~/.mutka/modules) if missing. Overwrites an
/// existing index.js (an update). Returns the absolute entry path.
#[tauri::command]
pub fn install_module(id: String, source: String) -> Result<String, String> {
    if !is_safe_id(&id) {
        return Err(format!("Invalid module id: {:?}", id));
    }
    let dir = modules_dir().join(&id);
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {}", dir.display(), e))?;
    let entry = dir.join("index.js");
    fs::write(&entry, source).map_err(|e| format!("Cannot write {}: {}", entry.display(), e))?;
    Ok(entry.to_string_lossy().to_string())
}

/// Remove a community module directory (~/.mutka/modules/<id>/) entirely.
/// No error if it doesn't exist (already gone is success).
#[tauri::command]
pub fn uninstall_module(id: String) -> Result<(), String> {
    if !is_safe_id(&id) {
        return Err(format!("Invalid module id: {:?}", id));
    }
    let dir = modules_dir().join(&id);
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| format!("Cannot remove {}: {}", dir.display(), e))
}

// ─── Manager config (~/.mutka/config.json) ────────────────────────────────────
// One JSON file owns which modules are disabled and install metadata (repo, ref).
// GitHub is the source of truth for what's installable today; this file is the
// local record of what the user installed and toggled off. Kept as an opaque
// string here — the frontend owns the schema (module-manager/types.ts).

fn config_path() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    std::path::PathBuf::from(home).join(".mutka").join("config.json")
}

/// Read ~/.mutka/config.json. Returns an empty string if it doesn't exist yet
/// (the frontend treats that as "default config").
#[tauri::command]
pub fn read_module_config() -> Result<String, String> {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(format!("Cannot read {}: {}", path.display(), e)),
    }
}

/// Write ~/.mutka/config.json, creating ~/.mutka if needed.
#[tauri::command]
pub fn write_module_config(content: String) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create {}: {}", parent.display(), e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Cannot write {}: {}", path.display(), e))
}
