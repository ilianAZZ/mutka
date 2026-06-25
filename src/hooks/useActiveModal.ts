import { useEffect, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";
import { UIStore, type ActiveModal } from "../core/stores/UIStore";

/** The declarative modal currently open app-wide (a module pushed it), or null. */
export function useActiveModal(): ActiveModal | null {
  const [modal, setModal] = useState<ActiveModal | null>(() => UIStore.modal);
  useEffect(() => EventBus.on(Events.Ui.changed, () => setModal(UIStore.modal)), []);
  return modal;
}
