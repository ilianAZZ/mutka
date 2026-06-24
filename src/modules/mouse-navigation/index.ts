import type { MacowsModule } from "../../core/module-registry/module-registry.types";
import { EventBus } from "../../core/event-bus/EventBus";

type Unsub = () => void;
let unsubNavigate: Unsub | null = null;

export const mouseNavigationModule: MacowsModule = {
  id: "core.mouse-navigation",
  name: "Mouse Navigation",
  version: "1.0.0",
  description: "Binds mouse back/forward buttons to history navigation",
  actions: [],
  onMount(): void {
    unsubNavigate = EventBus.on("input:mouse-navigate", (data) => {
      const { direction } = data as { direction: "back" | "forward" };
      const actionId =
        direction === "back" ? "core.navigation.go-back" : "core.navigation.go-forward";
      document.dispatchEvent(new CustomEvent("macows:action", { detail: { actionId } }));
    });
  },
  onUnmount(): void {
    unsubNavigate?.();
    unsubNavigate = null;
  },
};
