---
name: macos-nsevent
description: Intercept macOS native NSEvent events (mouse buttons, keyboard combos, gestures) in the Tauri Rust backend before WKWebView consumes them.
---

# Skill: Intercept macOS native events via NSEvent

Use this skill when you need to handle macOS system events that WKWebView (Tauri's
webview) intercepts before JavaScript sees them.

**Common cases:**
- Mouse back/forward buttons (swipe events, type 31)
- Special keyboard combos that macOS handles natively (e.g. ⌘[ / ⌘] for webview navigation)
- Gesture events from a trackpad or mouse driver

---

## Why DOM events aren't enough

WKWebView processes many events at the OS level before dispatching them to JavaScript.
For example: back/forward mouse buttons are converted to `NSEventTypeSwipe` gestures
by mouse drivers and handled by WKWebView's built-in navigation — the DOM `mousedown`
event never fires.

The fix is a **Rust `NSEvent` local monitor** that runs *before* WKWebView sees the event.

---

## Step 1 — Diagnose: what event type is being sent?

Add a temporary `NSEventMaskAny` monitor to log all events:

```rust
// In lib.rs setup(), temporarily:
let mask: u64 = u64::MAX; // NSEventMaskAny

let block = ConcreteBlock::new(|event: Id| -> Id {
    let event_type: u64 = msg_send![event, type];
    let button: i64 = msg_send![event, buttonNumber];
    // Skip noise: mouseMoved=5, leftDrag=6, rightDrag=7, cursorUpdate=17
    if ![5u64, 6, 7, 17].contains(&event_type) {
        eprintln!("[debug] type={} button={}", event_type, button);
    }
    event // always pass events through during diagnosis
});
```

Common NSEvent type values:
| type | Name | When |
|---|---|---|
| 1 | leftMouseDown | Left click |
| 3 | rightMouseDown | Right click |
| 10 | keyDown | Key pressed |
| 22 | scrollWheel | Scroll / trackpad scroll |
| 25 | otherMouseDown | Middle click, raw HID buttons |
| 29 | beginGesture | Trackpad gesture start |
| 31 | swipe | Mouse driver back/forward OR trackpad swipe |

---

## Step 2 — Add dependencies to Cargo.toml

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc = "0.2"
block = "0.1"
```

These are already transitive deps of `window-vibrancy` — declaring them explicitly
just makes the version contract explicit.

---

## Step 3 — Enable macro imports at crate root (lib.rs top)

```rust
#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;
```

This makes `msg_send!`, `class!`, `sel!` available throughout the file.
Must be at the very top, before any `use` statements.

---

## Step 4 — Add the Tauri event emitter import

```rust
use tauri::{Emitter, Manager};  // Emitter is needed for app_handle.emit()
```

---

## Step 5 — Create a static AppHandle and optional debounce

```rust
// Set once in setup(), read from the NSEvent block.
#[cfg(target_os = "macos")]
static APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

// Optional: debounce if the driver sends event bursts per input
#[cfg(target_os = "macos")]
static LAST_EVENT: std::sync::Mutex<Option<std::time::Instant>> = std::sync::Mutex::new(None);
```

---

## Step 6 — Write the monitor function

```rust
#[cfg(target_os = "macos")]
unsafe fn setup_my_monitor() {
    use block::ConcreteBlock;

    type Id = *mut objc::runtime::Object;

    // Replace with the mask(s) you identified in Step 1
    // NSEventMaskSwipe = 1 << 31, NSEventMaskOtherMouseDown = 1 << 25
    let mask: u64 = 1 << 31;

    let block = ConcreteBlock::new(|event: Id| -> Id {
        // Read event properties
        let delta_x: f64 = msg_send![event, deltaX];

        // Debounce if needed (mouse drivers send bursts)
        let now = std::time::Instant::now();
        let mut last = LAST_EVENT.lock().unwrap();
        if let Some(t) = *last {
            if now.duration_since(t).as_millis() < 400 {
                return std::ptr::null_mut(); // consume + ignore
            }
        }
        *last = Some(now);
        drop(last);

        // Emit a Tauri event to the frontend
        if let Some(handle) = APP_HANDLE.get() {
            let _ = handle.emit("my-event", "payload");
        }

        std::ptr::null_mut() // return nil to consume; return `event` to pass through
    });
    let block = block.copy(); // heap-allocate before passing to ObjC

    let cls = class!(NSEvent);
    let monitor: Id = msg_send![
        cls,
        addLocalMonitorForEventsMatchingMask: mask
        handler: &*block
    ];
    if !monitor.is_null() {
        let _: () = msg_send![monitor, retain]; // keep alive for app lifetime
    }
    std::mem::forget(block); // let ObjC manage block lifetime
}
```

---

## Step 7 — Call it in setup()

```rust
.setup(|app| {
    // ... existing setup ...
    #[cfg(target_os = "macos")]
    {
        APP_HANDLE.set(app.handle().clone()).ok();
        unsafe { setup_my_monitor() };
    }
    Ok(())
})
```

---

## Step 8 — Surface the event to modules

Sandboxed modules cannot call `listen()` or `invoke()` — they only receive WHITELISTED
events via `host.events.on(...)`. So a raw Tauri event is bridged in two steps:

**8a.** In the core (e.g. `src/core/input-manager/InputManager.ts`, which runs in the
main thread), subscribe to the Tauri event and re-emit it as a semantic app event:

```typescript
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

let unlisten: UnlistenFn | null = null;

listen<string>("my-event", (event) => {
    // translate to a semantic event the app understands
    EventBus.emit("input:my-thing", { /* payload */ });
}).then((fn) => { unlisten = fn; })
  .catch(() => { /* not in Tauri */ });

// on teardown: unlisten?.();
```

**8b.** Add the semantic event name to the subscribable whitelist in
`src/core/sandbox/eventWhitelist.ts`, then a module reacts to it:

```typescript
// src/sandbox-builtins/<name>.ts
setup(host) {
    host.events.on("input:my-thing", (payload) => {
        // act via declared capabilities, e.g. host.nav.goBack()
    });
},
```

Real example: `src/sandbox-builtins/mouse-navigation.ts` subscribes to
`"input:mouse-navigate"` and reaches history navigation through `host.nav` (a declared
`navigation` capability), never by dispatching an action.

---

## Key pitfalls

| Pitfall | Fix |
|---|---|
| `sel` not found at compile time | Add `#[macro_use] extern crate objc;` at crate root |
| `.emit()` not found | Add `use tauri::Emitter;` |
| Monitor fires but nothing happens | Check debounce window — driver may send events faster than the threshold |
| Monitor never fires | Wrong mask. Run diagnostic with `NSEventMaskAny` first |
| Navigation feels reversed on swipe events | macOS swipe convention: `deltaX > 0` = go back, `deltaX < 0` = go forward. Do NOT flip for standard HID button events (buttonNumber 3=back, 4=forward) |
| Block crashes at runtime | Always call `block.copy()` before passing to ObjC, then `std::mem::forget(block)` |
| App crashes on non-macOS | Wrap everything in `#[cfg(target_os = "macos")]` |
