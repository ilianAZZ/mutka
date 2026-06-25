import { useEffect, useRef, useState } from "react";
import { EventBus } from "../core/event-bus/EventBus";
import { Events } from "../core/event-bus/events";

/**
 * Flashes the back/forward toolbar buttons for 200ms when a navigation event
 * fires (e.g. from the mouse back/forward buttons), so keyboard/mouse-driven
 * navigation gives the same visual feedback as a click.
 */
export function useToolbarFlash(): "back" | "forward" | null {
  const [flashedBtn, setFlashedBtn] = useState<"back" | "forward" | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flash = (dir: "back" | "forward") => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlashedBtn(dir);
      flashTimerRef.current = setTimeout(() => setFlashedBtn(null), 200);
    };
    const unsubBack = EventBus.on(Events.Navigation.back, () => flash("back"));
    const unsubForward = EventBus.on(Events.Navigation.forward, () => flash("forward"));
    return () => {
      unsubBack();
      unsubForward();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return flashedBtn;
}
