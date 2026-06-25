// ─── Native macOS file icons ─────────────────────────────────────────────────
// Renders the icons Finder shows (NSWorkspace / Launch Services) to base64 PNG
// data-URIs. The frontend caches one per extension; a module may override one.

// Renders the native macOS icon (NSWorkspace / Launch Services) for a file type
// to a PNG and returns it as a 64×64 base64 data-URI. These are the exact icons
// Finder shows — the default for every file unless a module registers an override.
#[cfg(target_os = "macos")]
unsafe fn native_icon_data_uri(extension: Option<&str>, is_dir: bool, path: Option<&str>) -> Result<String, String> {
    use base64::Engine;
    use std::ffi::CString;
    type Id = *mut objc::runtime::Object;

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

    // The icon carries multiple representations; TIFFRepresentation renders them.
    // The frontend sizes the <img> down via CSS, so we ship the icon as-is and
    // cache one PNG per extension. No setSize: (passing an NSSize by value needs
    // a fragile objc::Encode impl we'd rather avoid).
    let tiff: Id = msg_send![icon, TIFFRepresentation];
    if tiff.is_null() {
        return Err("icon TIFFRepresentation was null".into());
    }
    let rep: Id = msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff];
    if rep.is_null() {
        return Err("NSBitmapImageRep creation failed".into());
    }
    // NSBitmapImageFileTypePNG == 4.
    let png: Id = msg_send![rep, representationUsingType: 4u64
                                 properties: std::ptr::null::<objc::runtime::Object>()];
    if png.is_null() {
        return Err("PNG representation was null".into());
    }

    let len: usize = msg_send![png, length];
    let bytes_ptr: *const u8 = msg_send![png, bytes];
    if bytes_ptr.is_null() || len == 0 {
        return Err("empty PNG data".into());
    }
    let slice = std::slice::from_raw_parts(bytes_ptr, len);
    let b64 = base64::engine::general_purpose::STANDARD.encode(slice);
    Ok(format!("data:image/png;base64,{}", b64))
}

/// Return the native macOS icon for a file type (by extension, or the generic
/// folder icon when is_dir) as a base64 PNG data-URI. The frontend caches per
/// extension; a module may override an extension with its own image.
#[tauri::command]
pub fn icon_for_type(extension: Option<String>, is_dir: bool, path: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        return native_icon_data_uri(extension.as_deref(), is_dir, path.as_deref());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (extension, is_dir, path);
        Err("native icons are only available on macOS".into())
    }
}
