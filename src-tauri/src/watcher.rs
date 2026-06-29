// Watches the single directory currently in view. read_dir re-arms it on every
// navigation. On a real change it emits `directory-changed` (payload: the changed
// path); the frontend (core/file-watch/DirectoryWatcher.ts) debounces and
// re-broadcasts on the bus.
//
// HARD RULE: watching must NEVER slow down or block directory listing — rendering
// folder content is what matters; watching is a best-effort extra. Two safeguards:
//   1. arm() sends to a channel and returns immediately; one long-lived worker
//      thread processes the re-arm, so read_dir never waits on FSEvents setup.
//      (Previously arm() spawned a fresh thread per navigation; rapid navigation
//      with held arrow keys created a burst of short-lived threads contending on
//      one lock — now they are coalesced into a single worker queue.)
//   2. ONE persistent watcher is reused (unwatch old path + watch new path) rather
//      than dropped and recreated each navigation — dropping a macOS FSEvents
//      watcher joins its run-loop thread, which is exactly what caused listings to
//      stall.
// We also ignore `Access` events so merely reading a directory can't trigger a
// refresh that reads it again (a feedback loop).
//
// State lives here (a process-global), mirroring the mouse_nav pattern.

use std::path::Path;
use std::sync::{
    mpsc::{self, Sender},
    Mutex, OnceLock,
};

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

struct WatchState {
    watcher: Option<RecommendedWatcher>,
    path: Option<String>,
}

static STATE: OnceLock<Mutex<WatchState>> = OnceLock::new();

fn state() -> &'static Mutex<WatchState> {
    STATE.get_or_init(|| Mutex::new(WatchState { watcher: None, path: None }))
}

/// The single worker thread's sender. Initialised once; the worker lives for the
/// process lifetime and sequentially processes re-arm requests.
static WORKER_TX: OnceLock<Sender<(AppHandle, String)>> = OnceLock::new();

/// Best-effort: watch `path`, replacing the previous watch. Returns immediately —
/// the actual work is queued to a single long-lived worker thread so the directory
/// listing is never blocked. A no-op (on that thread) if we are already watching `path`.
pub fn arm(app: &AppHandle, path: &str) {
    let tx = WORKER_TX.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<(AppHandle, String)>();
        std::thread::spawn(move || {
            for (app, path) in rx {
                rearm(app, path);
            }
        });
        tx
    });
    let _ = tx.send((app.clone(), path.to_string()));
}

fn rearm(app: AppHandle, path: String) {
    let mut st = match state().lock() {
        Ok(s) => s,
        Err(_) => return,
    };
    if st.path.as_deref() == Some(path.as_str()) {
        return; // already watching this directory
    }

    // Create the single watcher lazily on first use; reuse it forever after.
    if st.watcher.is_none() {
        let cb_app = app.clone();
        let watcher = RecommendedWatcher::new(
            move |res: notify::Result<notify::Event>| {
                if let Ok(event) = res {
                    // Ignore pure access events — reading a dir must not loop back
                    // into a refresh that reads it again.
                    if matches!(event.kind, EventKind::Access(_)) {
                        return;
                    }
                    let changed = event
                        .paths
                        .first()
                        .and_then(|p| p.to_str())
                        .unwrap_or("")
                        .to_string();
                    let _ = cb_app.emit("directory-changed", changed);
                }
            },
            Config::default(),
        );
        match watcher {
            Ok(w) => st.watcher = Some(w),
            Err(_) => return,
        }
    }

    // Swap the watched path on the existing watcher (no drop, no thread join).
    if let Some(old) = st.path.take() {
        if let Some(w) = st.watcher.as_mut() {
            let _ = w.unwatch(Path::new(&old));
        }
    }
    if let Some(w) = st.watcher.as_mut() {
        if w.watch(Path::new(&path), RecursiveMode::NonRecursive).is_ok() {
            st.path = Some(path);
        }
    }
}
