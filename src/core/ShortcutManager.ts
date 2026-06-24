class ShortcutManagerClass {
  private bindings = new Map<string, string>(); // normalized key -> actionId

  constructor() {
    document.addEventListener("keydown", (e) => {
      const key = this.normalize(e);
      const actionId = this.bindings.get(key);
      if (actionId) {
        e.preventDefault();
        document.dispatchEvent(
          new CustomEvent("macows:action", { detail: { actionId } })
        );
      }
    });
  }

  bind(shortcut: string, actionId: string): void {
    const normalized = shortcut.toLowerCase();
    const existing = this.bindings.get(normalized);
    if (existing && existing !== actionId) {
      console.warn(
        `[ShortcutManager] Conflict: "${shortcut}" was bound to "${existing}", overriding with "${actionId}"`
      );
    }
    this.bindings.set(normalized, actionId);
  }

  unbind(shortcut: string): void {
    this.bindings.delete(shortcut.toLowerCase());
  }

  private normalize(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.metaKey) parts.push("meta");
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    parts.push(e.key.toLowerCase());
    return parts.join("+");
  }
}

export const ShortcutManager = new ShortcutManagerClass();
