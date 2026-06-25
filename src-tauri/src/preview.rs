// ─── Native Quick Look preview (QLPreviewPanel) ──────────────────────────────
// The live, Finder-style Quick Look panel: space opens it, changing the
// selection updates it in place, space again closes it. Implemented over the
// native QLPreviewPanel through a tiny ObjC data source. See src-tauri/CLAUDE.md.

#[cfg(target_os = "macos")]
use std::sync::Mutex;

// The file the panel currently previews. Read by the ObjC data source callbacks
// (on the main thread) and written by the Tauri commands below.
#[cfg(target_os = "macos")]
static CURRENT_PATH: Mutex<Option<String>> = Mutex::new(None);

#[cfg(target_os = "macos")]
mod ql {
    use super::CURRENT_PATH;
    use objc::declare::ClassDecl;
    use objc::runtime::{Object, Sel, BOOL, NO};
    use std::ffi::CString;
    use std::sync::OnceLock;

    type Id = *mut Object;

    // The shared data source instance, stored as a pointer-sized integer so it is
    // Send (it only ever lives on the main thread). Built once, retained forever.
    static DATA_SOURCE: OnceLock<usize> = OnceLock::new();

    // QLPreviewPanelDataSource: how many items the panel shows (0 or 1).
    extern "C" fn number_of_items(_this: &Object, _cmd: Sel, _panel: Id) -> isize {
        match CURRENT_PATH.lock().unwrap().as_deref() {
            Some(p) if !p.is_empty() => 1,
            _ => 0,
        }
    }

    // QLPreviewPanelDataSource: the item at `index` as a file NSURL (NSURL
    // conforms to QLPreviewItem). Returns nil when no path is set.
    extern "C" fn preview_item_at(_this: &Object, _cmd: Sel, _panel: Id, _index: isize) -> Id {
        let guard = CURRENT_PATH.lock().unwrap();
        let path = match guard.as_deref() {
            Some(p) if !p.is_empty() => p,
            _ => return std::ptr::null_mut(),
        };
        let cstr = match CString::new(path) {
            Ok(c) => c,
            Err(_) => return std::ptr::null_mut(),
        };
        unsafe {
            let ns_path: Id = msg_send![class!(NSString), stringWithUTF8String: cstr.as_ptr()];
            msg_send![class!(NSURL), fileURLWithPath: ns_path]
        }
    }

    // Build (once) and return the shared data source object.
    fn data_source() -> Id {
        *DATA_SOURCE.get_or_init(|| unsafe {
            let mut decl = ClassDecl::new("MutkaQLDataSource", class!(NSObject))
                .expect("MutkaQLDataSource already registered");
            decl.add_method(
                sel!(numberOfPreviewItemsInPreviewPanel:),
                number_of_items as extern "C" fn(&Object, Sel, Id) -> isize,
            );
            decl.add_method(
                sel!(previewPanel:previewItemAtIndex:),
                preview_item_at as extern "C" fn(&Object, Sel, Id, isize) -> Id,
            );
            let cls = decl.register();
            let obj: Id = msg_send![cls, new];
            obj as usize
        }) as Id
    }

    /// Toggle the shared Quick Look panel: open it on the current path, or close
    /// it if already visible. MUST run on the main (AppKit) thread.
    pub unsafe fn toggle() {
        let panel: Id = msg_send![class!(QLPreviewPanel), sharedPreviewPanel];
        let visible: BOOL = msg_send![panel, isVisible];
        if visible != NO {
            let _: () = msg_send![panel, orderOut: std::ptr::null_mut::<Object>()];
            return;
        }
        let ds = data_source();
        let _: () = msg_send![panel, setDataSource: ds];
        let _: () = msg_send![panel, reloadData];
        let _: () = msg_send![panel, makeKeyAndOrderFront: std::ptr::null_mut::<Object>()];
    }

    /// Refresh the panel's content from CURRENT_PATH, but only if it is already
    /// open — so changing the selection updates a live panel yet never forces one
    /// open. MUST run on the main (AppKit) thread.
    pub unsafe fn refresh() {
        let exists: BOOL = msg_send![class!(QLPreviewPanel), sharedPreviewPanelExists];
        if exists == NO {
            return;
        }
        let panel: Id = msg_send![class!(QLPreviewPanel), sharedPreviewPanel];
        let visible: BOOL = msg_send![panel, isVisible];
        if visible != NO {
            let _: () = msg_send![panel, reloadData];
        }
    }
}

/// Open or toggle the live Quick Look panel for `path` (Finder's spacebar).
#[tauri::command]
pub fn quick_look(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        *CURRENT_PATH.lock().unwrap() = Some(path);
        app.run_on_main_thread(|| unsafe { ql::toggle() })
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, path);
    Ok(())
}

/// Update the panel to preview `path` — only if it is already open. Lets a
/// selection change refresh a live panel without ever forcing one open.
#[tauri::command]
pub fn preview_update(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        *CURRENT_PATH.lock().unwrap() = Some(path);
        app.run_on_main_thread(|| unsafe { ql::refresh() })
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, path);
    Ok(())
}
