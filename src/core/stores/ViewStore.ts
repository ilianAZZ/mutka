import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

const SHOW_HIDDEN_KEY = "macows.showHidden";

function loadShowHidden(): boolean {
  try {
    return localStorage.getItem(SHOW_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * View preferences that affect what the listing shows but aren't part of the
 * listing data itself. Currently just `showHidden` (dotfiles), persisted across
 * sessions. Sorting lives in ListingStore; this is the sibling for view toggles.
 * Emits `view:changed` so App re-reads the directory when a preference flips.
 */
class ViewStoreClass {
  private _showHidden: boolean = loadShowHidden();

  /** Whether dotfiles (hidden/system files) are shown in the listing. */
  get showHidden(): boolean {
    return this._showHidden;
  }

  setShowHidden(value: boolean): void {
    if (this._showHidden === value) return;
    this._showHidden = value;
    this.persist();
    EventBus.emit(Events.View.changed, { showHidden: value });
  }

  toggleHidden(): void {
    this.setShowHidden(!this._showHidden);
  }

  private persist(): void {
    try {
      localStorage.setItem(SHOW_HIDDEN_KEY, String(this._showHidden));
    } catch {
      /* ignore */
    }
  }
}

export const ViewStore = new ViewStoreClass();
