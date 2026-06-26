// Insets the native macOS traffic-light buttons from the window corner.
//
// With `titleBarStyle: "Overlay"` the window is frameless but AppKit still draws
// the close/minimize/zoom buttons pinned flush to the top-left corner. To match
// Mutka's padded glass layout we nudge them inward: the title-bar container view
// is grown so the buttons aren't clipped, then each button is re-placed from the
// left. AppKit re-lays-out these buttons on resize, so the caller re-applies this
// on every `Resized` event (see lib.rs).
//
// Uses raw `objc` msg_send! like the other macOS files (icons.rs, launch.rs, …)
// rather than the deprecated `cocoa` crate's typed wrappers.

type Id = *mut objc::runtime::Object;

/// `NSWindow standardWindowButton:` indices (an `NSWindowButton` / NSUInteger).
const NS_WINDOW_CLOSE_BUTTON: u64 = 0;
const NS_WINDOW_MINIATURIZE_BUTTON: u64 = 1;
const NS_WINDOW_ZOOM_BUTTON: u64 = 2;

/// Distance of the leftmost (close) button from the window's left edge, in points.
const INSET_X: f64 = 25.0;
/// Extra title-bar height added below the buttons — pushes them down from the top.
const INSET_Y: f64 = 30.0;

// Minimal AppKit geometry structs. `CGFloat` is `f64` on 64-bit macOS (the only
// target), so the ObjC type encodings are the fixed strings below — this is the
// same thing cocoa-foundation generates, without depending on the deprecated crate.
#[repr(C)]
#[derive(Copy, Clone)]
struct NSPoint {
    x: f64,
    y: f64,
}
unsafe impl objc::Encode for NSPoint {
    fn encode() -> objc::Encoding {
        unsafe { objc::Encoding::from_str("{CGPoint=dd}") }
    }
}

#[repr(C)]
#[derive(Copy, Clone)]
struct NSSize {
    width: f64,
    height: f64,
}
unsafe impl objc::Encode for NSSize {
    fn encode() -> objc::Encoding {
        unsafe { objc::Encoding::from_str("{CGSize=dd}") }
    }
}

#[repr(C)]
#[derive(Copy, Clone)]
struct NSRect {
    origin: NSPoint,
    size: NSSize,
}
unsafe impl objc::Encode for NSRect {
    fn encode() -> objc::Encoding {
        unsafe { objc::Encoding::from_str("{CGRect={CGPoint=dd}{CGSize=dd}}") }
    }
}

/// Reposition the three standard window buttons. `ns_window` must be a valid
/// `NSWindow*`. No-op if the buttons or their container view aren't available yet.
pub unsafe fn position_traffic_lights(ns_window: Id) {
    let close: Id = msg_send![ns_window, standardWindowButton: NS_WINDOW_CLOSE_BUTTON];
    let mini: Id = msg_send![ns_window, standardWindowButton: NS_WINDOW_MINIATURIZE_BUTTON];
    let zoom: Id = msg_send![ns_window, standardWindowButton: NS_WINDOW_ZOOM_BUTTON];
    if close.is_null() || mini.is_null() || zoom.is_null() {
        return;
    }

    // The buttons live two levels under the title-bar container view.
    let title_view: Id = msg_send![close, superview];
    let container: Id = msg_send![title_view, superview];
    if container.is_null() {
        return;
    }

    let close_frame: NSRect = msg_send![close, frame];
    let content_view: Id = msg_send![ns_window, contentView];
    let content_frame: NSRect = msg_send![content_view, frame];

    // Grow the container so moving the buttons down doesn't clip them, keeping it
    // pinned to the top of the content view.
    let bar_height = close_frame.size.height + INSET_Y;
    let mut bar_frame: NSRect = msg_send![container, frame];
    bar_frame.size.height = bar_height;
    bar_frame.origin.y = content_frame.size.height - bar_height;
    let _: () = msg_send![container, setFrame: bar_frame];

    // Re-space the buttons horizontally from INSET_X, preserving their native gap.
    // Pin all three to the minimize button's y: AppKit hands the close button a
    // slightly different origin.y after the container grows, so reusing each
    // button's own y would leave the red one sitting a hair higher than the rest.
    let mini_frame: NSRect = msg_send![mini, frame];
    let spacing = mini_frame.origin.x - close_frame.origin.x;
    let baseline_y = mini_frame.origin.y;
    for (i, button) in [close, mini, zoom].into_iter().enumerate() {
        let mut frame: NSRect = msg_send![button, frame];
        frame.origin.x = INSET_X + i as f64 * spacing;
        frame.origin.y = baseline_y;
        let _: () = msg_send![button, setFrameOrigin: frame.origin];
    }
}
