import { defineModule } from "../core/sandbox/defineModule";

// Binds mouse back/forward buttons (surfaced as "input:mouse-navigate" by
// InputManager) to history navigation. No commands — pure event reaction.
export default defineModule({
  id: "core.mouse-navigation",
  name: "Mouse Navigation",
  version: "1.0.0",
  description: "Binds mouse back/forward buttons to history navigation.",
  permissions: ["navigation"],
  setup(host) {
    host.events.on("input:mouse-navigate", (payload) => {
      const { direction } = payload as { direction: "back" | "forward" };
      if (direction === "back") host.nav.goBack();
      else host.nav.goForward();
    });
  },
});
