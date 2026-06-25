// ─── Community module discovery ──────────────────────────────────────────────
// Lists and reads community modules installed in ~/.macows/modules/. Reads are
// restricted to that directory so a module can never be loaded from elsewhere.

use std::fs;
use serde::Serialize;

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
/// Restricted to ~/.macows/modules/ — returns an error for any other path.
#[tauri::command]
pub fn read_module_file(path: String) -> Result<String, String> {
    let allowed = modules_dir().to_string_lossy().to_string();
    if !path.starts_with(&allowed) {
        return Err(format!("Access denied: {} is outside ~/.macows/modules", path));
    }
    fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {}", path, e))
}
