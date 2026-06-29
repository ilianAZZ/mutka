import { useEffect, useRef, useState } from "react";
import { NotificationStore, type Notification, type NotificationKind } from "../../core/stores/NotificationStore";
import "./NotificationToasts.css";

const ICON: Record<NotificationKind, string> = {
  error: "✕",
  warning: "⚠",
  success: "✓",
  info: "i",
};

/**
 * Stack of transient toasts (top-right), driven by NotificationStore. Gives the
 * user visual feedback for module errors / successes without opening the console.
 * Pure presentation — all state lives in the store. Renders nothing when empty.
 */
export function NotificationToasts() {
  const [items, setItems] = useState<Notification[]>(NotificationStore.getAll());
  const scheduled = useRef<Set<number>>(new Set());

  useEffect(() => NotificationStore.subscribe(setItems), []);

  // Schedule each auto-dismiss exactly once (so a new toast never resets another's timer).
  useEffect(() => {
    for (const n of items) {
      if (n.timeout > 0 && !scheduled.current.has(n.id)) {
        scheduled.current.add(n.id);
        setTimeout(() => NotificationStore.dismiss(n.id), n.timeout);
      }
    }
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="notif-stack" role="region" aria-label="Notifications">
      {items.map((n) => (
        <div key={n.id} className={`notif notif--${n.kind}`} role={n.kind === "error" ? "alert" : "status"}>
          <span className="notif-icon" aria-hidden>{ICON[n.kind]}</span>
          <div className="notif-text">
            <span className="notif-title">{n.title}</span>
            {n.message && <span className="notif-message">{n.message}</span>}
          </div>
          <button className="notif-close" onClick={() => NotificationStore.dismiss(n.id)} title="Dismiss" aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
