// ─── Native macOS file icons ─────────────────────────────────────────────────
// Renders the icons Finder shows (NSWorkspace / Launch Services) to base64 PNG
// data-URIs. Two layers of caching make repeated opens cheap:
//   1. The frontend keeps one icon per type in memory for the session.
//   2. This module persists each type-keyed icon to ~/.mutka/icon-cache so the
//      (expensive) native render happens once ever, not once per launch.
// We also encode a single small representation rather than the icon's full
// multi-size TIFF (whose largest rep can be 512–1024px) — encoding that big rep
// to PNG was the dominant cost of opening a folder.

// Target pixel size for the encoded icon. The UI shows it at ~16–20pt; 64px
// stays crisp on Retina while being far cheaper to encode than the 512/1024px
// representation NSWorkspace also carries.
#[cfg(target_os = "macos")]
const ICON_TARGET_PX: i64 = 64;

// ─── Disk cache (~/.mutka/icon-cache) ────────────────────────────────────────

#[cfg(target_os = "macos")]
fn icon_cache_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    std::path::PathBuf::from(home).join(".mutka").join("icon-cache")
}

/// A safe cache filename for a TYPE-keyed icon, or None for per-path icons
/// (bundles, custom-icon folders). Per-path icons are item-specific and mutable,
/// so they are rendered fresh and never cached to disk.
#[cfg(target_os = "macos")]
fn cache_key(extension: Option<&str>, is_dir: bool, path: Option<&str>) -> Option<String> {
    if path.is_some() {
        return None;
    }
    if is_dir {
        return Some("dir.txt".to_string());
    }
    let ext = extension.unwrap_or("none").to_lowercase();
    // Keep only safe characters so an extension can never escape the cache dir.
    let safe: String = ext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    let safe = if safe.is_empty() { "none".to_string() } else { safe };
    Some(format!("ext-{}.txt", safe))
}

#[cfg(target_os = "macos")]
fn read_icon_cache(key: &str) -> Option<String> {
    std::fs::read_to_string(icon_cache_dir().join(key))
        .ok()
        .filter(|s| !s.is_empty())
}

#[cfg(target_os = "macos")]
fn write_icon_cache(key: &str, data_uri: &str) {
    let dir = icon_cache_dir();
    let _ = std::fs::create_dir_all(&dir); // best-effort: a cache miss is harmless
    let _ = std::fs::write(dir.join(key), data_uri);
}

// ─── Native rendering ─────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
type Id = *mut objc::runtime::Object;

/// PNG-encode the smallest bitmap representation of `icon` whose width is at
/// least ICON_TARGET_PX (falling back to the largest bitmap rep). Returns None
/// if the icon carries no NSBitmapImageRep — the caller then encodes the full
/// TIFF instead. Encoding one small rep is what keeps icon rendering fast.
#[cfg(target_os = "macos")]
unsafe fn png_from_small_rep(icon: Id) -> Option<Vec<u8>> {
    use objc::runtime::{BOOL, NO};

    let reps: Id = msg_send![icon, representations];
    if reps.is_null() {
        return None;
    }
    let count: usize = msg_send![reps, count];

    let mut best: Id = std::ptr::null_mut(); // smallest rep with width >= target
    let mut best_w: i64 = i64::MAX;
    let mut largest: Id = std::ptr::null_mut();
    let mut largest_w: i64 = -1;

    for i in 0..count {
        let rep: Id = msg_send![reps, objectAtIndex: i];
        // Only NSBitmapImageRep can PNG-encode itself directly.
        let is_bitmap: BOOL = msg_send![rep, isKindOfClass: class!(NSBitmapImageRep)];
        if is_bitmap == NO {
            continue;
        }
        let w: i64 = msg_send![rep, pixelsWide];
        if w > largest_w {
            largest_w = w;
            largest = rep;
        }
        if w >= ICON_TARGET_PX && w < best_w {
            best_w = w;
            best = rep;
        }
    }

    let chosen: Id = if !best.is_null() { best } else { largest };
    if chosen.is_null() {
        return None;
    }
    png_bytes_of_rep(chosen)
}

/// PNG bytes of a single NSBitmapImageRep (or None on failure).
#[cfg(target_os = "macos")]
unsafe fn png_bytes_of_rep(rep: Id) -> Option<Vec<u8>> {
    // NSBitmapImageFileTypePNG == 4.
    let png: Id = msg_send![rep, representationUsingType: 4u64
                                 properties: std::ptr::null::<objc::runtime::Object>()];
    if png.is_null() {
        return None;
    }
    let len: usize = msg_send![png, length];
    let bytes_ptr: *const u8 = msg_send![png, bytes];
    if bytes_ptr.is_null() || len == 0 {
        return None;
    }
    Some(std::slice::from_raw_parts(bytes_ptr, len).to_vec())
}

/// Fallback: PNG-encode the icon's full TIFF (the original behaviour) for icons
/// that have no directly-encodable bitmap representation.
#[cfg(target_os = "macos")]
unsafe fn png_from_full_tiff(icon: Id) -> Result<Vec<u8>, String> {
    let tiff: Id = msg_send![icon, TIFFRepresentation];
    if tiff.is_null() {
        return Err("icon TIFFRepresentation was null".into());
    }
    let rep: Id = msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff];
    if rep.is_null() {
        return Err("NSBitmapImageRep creation failed".into());
    }
    png_bytes_of_rep(rep).ok_or_else(|| "PNG representation was null".into())
}

// Renders the native macOS icon (NSWorkspace / Launch Services) for a file type
// to a small PNG and returns it as a base64 data-URI. These are the exact icons
// Finder shows — the default for every file unless a module registers an override.
#[cfg(target_os = "macos")]
unsafe fn native_icon_data_uri(extension: Option<&str>, is_dir: bool, path: Option<&str>) -> Result<String, String> {
    use base64::Engine;
    use std::ffi::CString;

    // A specific path (e.g. an .app bundle) gets its OWN icon via iconForFile: —
    // that's how Safari.app and Mail.app show different icons. Otherwise:
    // folders use the standard system folder image (NSImageNameFolder == "NSFolder";
    // iconForFileType: predates UTIs and wouldn't resolve "public.folder"), and
    // files use iconForFileType: with their extension (Launch Services returns the
    // associated app's document icon, exactly what Finder shows).
    let icon: Id = if let Some(p) = path {
        let workspace: Id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let c = CString::new(p).map_err(|e| e.to_string())?;
        let ns_path: Id = msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()];
        msg_send![workspace, iconForFile: ns_path]
    } else if is_dir {
        let c = CString::new("NSFolder").map_err(|e| e.to_string())?;
        let ns_name: Id = msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()];
        msg_send![class!(NSImage), imageNamed: ns_name]
    } else {
        let workspace: Id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let c = CString::new(extension.unwrap_or("")).map_err(|e| e.to_string())?;
        let ns_type: Id = msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()];
        msg_send![workspace, iconForFileType: ns_type]
    };
    if icon.is_null() {
        return Err("could not obtain a native icon".into());
    }

    // Prefer a single small representation; fall back to the full TIFF render.
    let png = match png_from_small_rep(icon) {
        Some(bytes) => bytes,
        None => png_from_full_tiff(icon)?,
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
    Ok(format!("data:image/png;base64,{}", b64))
}

/// The native icon for a SPECIFIC path (e.g. an .app bundle) as a base64 PNG
/// data-URI. Reused by the "Open With" picker for application icons. Returns None
/// on failure; only meaningful on macOS.
#[cfg(target_os = "macos")]
pub(crate) fn path_icon_data_uri(path: &str) -> Option<String> {
    unsafe { native_icon_data_uri(None, false, Some(path)).ok() }
}

/// One icon to render: a file type (extension, or the generic folder icon when
/// is_dir) or a specific path (a bundle / custom-icon folder).
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IconSpec {
    pub extension: Option<String>,
    pub is_dir: bool,
    pub path: Option<String>,
}

/// Render many native icons in ONE call, off the main thread, returning a
/// base64 PNG data-URI (or null) per spec in order. This is the hot path for
/// opening a folder: the frontend sends every uncached file type at once so a
/// folder costs a single async IPC round-trip instead of one blocking
/// main-thread call per type. Type-keyed icons are served from / written to the
/// ~/.mutka/icon-cache disk cache so each type renders once ever.
///
/// `async` so Tauri runs it on a worker thread — the UI never freezes while
/// icons render. The AppKit work is wrapped in an autoreleasepool because we are
/// off the main thread (no run-loop pool to drain temporary objects).
#[tauri::command]
pub async fn icons_for_types(specs: Vec<IconSpec>) -> Result<Vec<Option<String>>, String> {
    #[cfg(target_os = "macos")]
    {
        let out = objc::rc::autoreleasepool(|| {
            specs
                .iter()
                .map(|s| {
                    let key = cache_key(s.extension.as_deref(), s.is_dir, s.path.as_deref());
                    if let Some(ref k) = key {
                        if let Some(hit) = read_icon_cache(k) {
                            return Some(hit);
                        }
                    }
                    let uri = unsafe {
                        native_icon_data_uri(s.extension.as_deref(), s.is_dir, s.path.as_deref())
                    }
                    .ok();
                    if let (Some(ref k), Some(ref u)) = (&key, &uri) {
                        write_icon_cache(k, u);
                    }
                    uri
                })
                .collect::<Vec<_>>()
        });
        Ok(out)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = specs;
        Err("native icons are only available on macOS".into())
    }
}

/// A type-keyed icon already on disk, with the key the frontend uses in memory.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedIcon {
    /// The frontend's nativeKey: "dir" or "ext:<extension>".
    pub key: String,
    pub data_uri: String,
}

/// Read every type-keyed icon from ~/.mutka/icon-cache into memory at launch, so
/// previously-seen file types render with zero IPC on the first folder open.
/// Filenames map back to the frontend's keys: dir.txt → "dir", ext-<e>.txt →
/// "ext:<e>". Per-path (bundle) icons are not cached, so none appear here.
#[tauri::command]
pub fn preload_icon_cache() -> Result<Vec<CachedIcon>, String> {
    #[cfg(target_os = "macos")]
    {
        let dir = icon_cache_dir();
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => return Ok(vec![]), // no cache yet
        };
        let mut out = Vec::new();
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let key = if name == "dir.txt" {
                "dir".to_string()
            } else if let Some(ext) = name.strip_prefix("ext-").and_then(|n| n.strip_suffix(".txt")) {
                format!("ext:{}", ext)
            } else {
                continue;
            };
            if let Ok(data_uri) = std::fs::read_to_string(entry.path()) {
                if !data_uri.is_empty() {
                    out.push(CachedIcon { key, data_uri });
                }
            }
        }
        Ok(out)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(vec![])
    }
}
