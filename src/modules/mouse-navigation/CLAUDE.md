# core.mouse-navigation — Module Documentation

Binds the mouse back/forward buttons to the app's history navigation
(`core.navigation.go-back` / `core.navigation.go-forward` actions).

---

## Architecture: two paths to handle all mice

On macOS, back/forward mouse buttons reach JavaScript via two different mechanisms
depending on the mouse driver. The module handles both.

### Path A — Driver-managed mice (Logitech Options+, SteerMouse, etc.)

Modern mouse drivers on macOS **do not** send raw button events for the back/forward
buttons. Instead they convert them to `NSEventTypeSwipe` (type 31) gestures, because
macOS WKWebView has a built-in gesture → navigation mapping.

Problem: these swipe events are handled at the OS/WKWebView level before JavaScript
ever sees them. The DOM `mousedown` event is never fired.

Solution: a Rust `NSEvent` local monitor intercepts the swipe events before
WKWebView dispatches them. When a horizontal swipe is detected, the monitor:

1. Emits a Tauri event `"mouse-navigate"` (`"back"` or `"forward"` as payload)
2. Returns `nil` to consume the event, preventing WKWebView from handling it

The module's `onMount()` subscribes to this Tauri event via `listen()`.

### Path B — Raw HID mice (no driver software)

Standard HID mice send `NSEventTypeOtherMouseDown` (type 25) events.
These DO fire a DOM `mousedown` event with `event.button === 3` (back)
or `event.button === 4` (forward).

The module's `onMount()` also attaches a `document.addEventListener("mousedown", ...)`
fallback that handles these.

---

## The deltaX direction: macOS swipe convention

**This is NOT specific to any mouse or driver — it is the macOS standard.**

On macOS, the swipe gesture direction for navigation is:

- `deltaX > 0` (swipe right) → **go back** in history
- `deltaX < 0` (swipe left) → **go forward** in history

This mirrors the native two-finger trackpad gesture in Safari and Finder.
Mouse drivers that implement back/forward via swipe (Logitech, etc.) follow this
same convention, so the mapping is universal across devices.

If you ever see navigation feel reversed on a new mouse, check which path it uses
(A or B) rather than flipping the deltaX sign.

---

## The debounce (400 ms)

Mouse drivers using Path A send a **burst of multiple swipe events** per physical
button press — typically 5–15 events in rapid succession. Without debouncing,
a single press would navigate back many times.

The 400 ms debounce in `lib.rs` (`LAST_NAV` static) ensures only the first event
in each burst triggers navigation. 400 ms was chosen because:

- It's fast enough to not feel sluggish for rapid successive clicks
- It's long enough to absorb any burst from the driver

---

## EventBus events consumed

| Event                    | Emitted by | What the module does |
| ------------------------ | ---------- | -------------------- |
| (none directly consumed) | —          | —                    |

The module dispatches `macows:action` DOM events, not EventBus events.
Navigation feedback (`navigation:back`, `navigation:forward`) is emitted by
`goBack()`/`goForward()` in `App.tsx` and consumed by the toolbar animation.

---

## Files

| File                   | Role                                                    |
| ---------------------- | ------------------------------------------------------- |
| `index.ts`             | Module registration, DOM listener, Tauri event listener |
| `src-tauri/src/lib.rs` | `setup_mouse_navigation()` — Rust NSEvent monitor       |

---

## Debugging checklist

If mouse buttons stop working:

1. **Nothing in terminal at startup** → Rust code not recompiled. Restart `npm run tauri dev`.
2. **`[mouse-nav]` not in terminal but navigation works via keyboard** → NSEvent monitor failed silently. Check that `setup_mouse_navigation()` is called in `run()`.
3. **Buttons trigger but navigation doesn't happen** → Check that `listen("mouse-navigate", ...)` resolves without error. Open DevTools and check the console.
4. **Middle click (button 2) shows in terminal but not back/forward** → The mouse sends buttons 3/4 via a different path (Path A vs B). Run with `NSEventMaskAny` (`u64::MAX`) temporarily and log all event types.
5. **Direction is reversed** → The mouse driver swaps swipe direction. Change the deltaX comparison in `setup_mouse_navigation()`. Do NOT change Path B (button numbers 3/4 are standard HID — 3 = back, 4 = forward).
