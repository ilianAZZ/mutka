import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

/**
 * The app's home directory, as a reactive store. Not resolved by the core: a
 * module (e.g. `core.home`) sets it at launch via the `home` capability, and any
 * module may override it later. Components read it and re-render on `home:changed`.
 * Starts at "/" until a module resolves the real path.
 */
class HomeStoreClass {
  private _homeDir = "/";

  /** The current home directory. */
  get homeDir(): string {
    return this._homeDir;
  }

  setHomeDir(path: string): void {
    if (this._homeDir === path) return;
    this._homeDir = path;
    EventBus.emit(Events.Home.changed, { homeDir: path });
  }
}

export const HomeStore = new HomeStoreClass();
