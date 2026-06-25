import { defineModule, type SandboxHostApi } from "../core/sandbox/defineModule";
import type { HostSnapshot } from "../core/sandbox/protocol";

// Keyboard navigation of the listing — the keyboard counterpart of click
// (select) and double-click (open). It reads the VISIBLE order from the snapshot
// (so it honors the active sort/filters) and drives the selection through the
// `view` capability; Enter activates via the open-resolution pipeline.
function move(host: SandboxHostApi, snap: HostSnapshot, step: 1 | -1): void {
  const items = snap.orderedItems;
  if (items.length === 0) return;
  const anchor = snap.selectedItems[snap.selectedItems.length - 1];
  const current = anchor ? items.findIndex((f) => f.path === anchor.path) : -1;
  const next = current === -1
    ? (step > 0 ? 0 : items.length - 1)
    : Math.min(items.length - 1, Math.max(0, current + step));
  host.selection.set([items[next]]);
}

export default defineModule({
  id: "core.selection",
  name: "Selection",
  version: "1.0.0",
  description: "Keyboard navigation of the file list: ↑/↓ move the selection, Enter opens it.",
  permissions: ["view", "navigation"],
  commands: [
    { id: "core.selection.move-down", label: "Select Next", shortcut: "arrowdown" },
    { id: "core.selection.move-up", label: "Select Previous", shortcut: "arrowup" },
    { id: "core.selection.open", label: "Open Selection", shortcut: "enter" },
  ],
  setup(host) {
    host.onCommand("core.selection.move-down", (snap) => { move(host, snap, 1); });
    host.onCommand("core.selection.move-up", (snap) => { move(host, snap, -1); });
    host.onCommand("core.selection.open", (snap) => {
      const last = snap.selectedItems[snap.selectedItems.length - 1];
      if (last) host.activate(last);
    });
  },
});
