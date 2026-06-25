import { listen } from "@tauri-apps/api/event";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

/**
 * Relays the Rust `directory-changed` event (the current directory changed on
 * disk) onto the typed EventBus as `directory:changed`, debounced to collapse the
 * burst a filesystem watcher emits per change. The actual watcher lives in Rust
 * (re-armed by read_dir); this only forwards. Uses `listen` (a platform
 * subscription) like InputManager — it never calls `invoke` for feature logic.
 */
class DirectoryWatcherClass {
  private started = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;

  /** Begin forwarding. Call once at startup (module scope in App.tsx). */
  init(): void {
    if (this.started) return;
    this.started = true;
    void listen<string>("directory-changed", (e) => this.schedule(e.payload));
  }

  private schedule(path: string): void {
    this.pending = path;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      const p = this.pending;
      this.pending = null;
      if (p !== null) EventBus.emit(Events.Directory.changed, { path: p });
    }, 150);
  }
}

export const DirectoryWatcher = new DirectoryWatcherClass();
