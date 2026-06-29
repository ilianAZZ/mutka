// ─── App metadata ────────────────────────────────────────────────────────────
// Read-only facts about the running build. Currently just the version string,
// which release-please keeps in lockstep across package.json / tauri.conf.json /
// Cargo.toml, so `CARGO_PKG_VERSION` (compiled in from Cargo.toml) is the single
// source of truth. Used by the telemetry module to tag events by version and to
// detect an app update across launches.

/// The app version (e.g. "1.0.0"), compiled in from Cargo.toml.
#[tauri::command]
pub fn get_app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}
