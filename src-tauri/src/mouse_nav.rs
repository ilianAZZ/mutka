// ─── Mouse back/forward navigation (NSEvent swipe monitor) ───────────────────
// macOS WKWebView intercepts mouse back/forward buttons before JS sees them, and
// mouse drivers (Logitech Options+, SteerMouse, …) convert those buttons to swipe
// gestures. We install an NSEvent local monitor that runs before WKWebView and
// emits a "mouse-navigate" event. See src-tauri/CLAUDE.md for the full rationale.

#[cfg(target_os = "macos")]
use tauri::Emitter;

#[cfg(target_os = "macos")]
static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

// Debounce state: the Logitech driver sends a burst of swipe events per button press.
#[cfg(target_os = "macos")]
static LAST_NAV: std::sync::Mutex<Option<std::time::Instant>> = std::sync::Mutex::new(None);

/// Store the app handle so the NSEvent monitor can emit events back to the UI.
#[cfg(target_os = "macos")]
pub fn set_app_handle(handle: tauri::AppHandle) {
    APP_HANDLE.set(handle).ok();
}

// Intercepts NSEventTypeSwipe (type 31) events before WKWebView sees them.
// macOS mouse drivers (e.g. Logitech Options+) convert back/forward buttons to swipe gestures.
// deltaX < 0 → back, deltaX > 0 → forward.
#[cfg(target_os = "macos")]
pub unsafe fn setup_mouse_navigation() {
    use block::ConcreteBlock;

    type Id = *mut objc::runtime::Object;

    // NSEventMaskSwipe = 1 << 31
    let mask: u64 = 1 << 31;

    let block = ConcreteBlock::new(|event: Id| -> Id {
        let delta_x: f64 = msg_send![event, deltaX];
        if delta_x == 0.0 {
            return event;
        }

        let now = std::time::Instant::now();
        // Never unwrap inside an ObjC callback: a poisoned mutex would panic
        // unwinding into AppKit (UB / crash). Recover the guard instead.
        let mut last = LAST_NAV.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(t) = *last {
            if now.duration_since(t).as_millis() < 400 {
                return std::ptr::null_mut();
            }
        }
        *last = Some(now);
        drop(last);

        // macOS swipe right (positive deltaX) = go back, left (negative) = go forward
        let dir = if delta_x > 0.0 { "back" } else { "forward" };
        if let Some(handle) = APP_HANDLE.get() {
            let _ = handle.emit("mouse-navigate", dir);
        }

        std::ptr::null_mut()
    });
    let block = block.copy();

    let cls = class!(NSEvent);
    let monitor: Id = msg_send![
        cls,
        addLocalMonitorForEventsMatchingMask: mask
        handler: &*block
    ];
    if !monitor.is_null() {
        let _: () = msg_send![monitor, retain];
    }
    std::mem::forget(block);
}
