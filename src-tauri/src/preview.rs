// ─── Quick Look preview ──────────────────────────────────────────────────────

/// Open the native macOS Quick Look preview for a file.
/// Uses `qlmanage -p`, which renders the same previews as Finder's spacebar.
#[tauri::command]
pub fn quick_look(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    std::process::Command::new("qlmanage")
        .args(["-p", &path])
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    let _ = path;
    Ok(())
}
