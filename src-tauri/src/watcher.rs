// Watches the single directory currently in view. read_dir re-arms it on every
// navigation, so exactly one non-recursive watcher is ever live. On any change
// it emits `directory-changed` (payload: the watched path); the frontend
// (core/file-watch/DirectoryWatcher.ts) debounces and re-broadcasts on the bus.
//
// State lives here (a process-global), mirroring the mouse_nav pattern. This is
// infrastructure plumbing, not business logic — what to DO on a change is decided
// in TypeScript.

use std::path::Path;
use std::sync::{Mutex, OnceLock};

use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

struct WatchState {
    watcher: Option<RecommendedWatcher>,
    path: Option<String>,
}

static STATE: OnceLock<Mutex<WatchState>> = OnceLock::new();

fn state() -> &'static Mutex<WatchState> {
    STATE.get_or_init(|| Mutex::new(WatchState { watcher: None, path: None }))
}

/// Arm a non-recursive watcher on `path`, replacing any previous one. A no-op if
/// we are already watching that directory. Failures are swallowed: watching is a
/// best-effort enhancement, never a reason to fail the directory listing.
pub fn arm(app: &AppHandle, path: &str) {
    let mut st = match state().lock() {
        Ok(s) => s,
        Err(_) => return,
    };
    if st.path.as_deref() == Some(path) {
        return;
    }
    st.watcher = None; // drop the previous watcher (stops its thread)

    let app = app.clone();
    let emit_path = path.to_string();
    let mut watcher = match RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            if res.is_ok() {
                let _ = app.emit("directory-changed", emit_path.clone());
            }
        },
        Config::default(),
    ) {
        Ok(w) => w,
        Err(_) => return,
    };

    if watcher.watch(Path::new(path), RecursiveMode::NonRecursive).is_ok() {
        st.watcher = Some(watcher);
        st.path = Some(path.to_string());
    }
}
