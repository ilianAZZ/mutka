// ─── NSPasteboard clipboard state ────────────────────────────────────────────
// Tracks the operation (copy/cut) we last wrote, and the pasteboard change count
// at that write. If the change count differs when reading, another app (e.g. Finder)
// wrote to the pasteboard in the meantime — we treat that as a copy.

use serde::{Deserialize, Serialize};
#[cfg(target_os = "macos")]
use std::sync::Mutex;

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
pub fn clipboard_write_files(paths: Vec<String>, operation: String) -> Result<(), String> {
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
pub fn clipboard_read_files() -> Result<Option<ClipboardReadResult>, String> {
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
