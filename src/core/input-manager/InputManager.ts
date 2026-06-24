import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { EventBus } from "../event-bus/EventBus";
import { Events } from "../event-bus/events";

// Emitted events:
//   "input:mouse-navigate"  payload: { direction: "back" | "forward" }

class InputManagerClass {
  private unlistenTauri: UnlistenFn | null = null;

  init(): void {
    document.addEventListener("mousedown", this.handleMouseDown);

    // Path A — Tauri NSEvent monitor (driver-managed mice: Logitech, SteerMouse…)
    // WKWebView intercepts raw buttons before JS sees them, so lib.rs monitors
    // NSEventTypeSwipe and forwards them as "mouse-navigate" Tauri events.
    listen<string>("mouse-navigate", (event) => {
      const direction = event.payload === "back" ? "back" : "forward";
      EventBus.emit(Events.Input.mouseNavigate, { direction });
    }).then((unlisten) => {
      this.unlistenTauri = unlisten;
    }).catch(() => {
      // Not running in Tauri — Path B (DOM) covers it.
    });
  }

  dispose(): void {
    document.removeEventListener("mousedown", this.handleMouseDown);
    this.unlistenTauri?.();
    this.unlistenTauri = null;
  }

  // Path B — raw HID mice send DOM mousedown with button 3/4.
  private readonly handleMouseDown = (e: MouseEvent): void => {
    if (e.button === 3) {
      e.preventDefault();
      EventBus.emit(Events.Input.mouseNavigate, { direction: "back" });
    } else if (e.button === 4) {
      e.preventDefault();
      EventBus.emit(Events.Input.mouseNavigate, { direction: "forward" });
    }
  };
}

export const InputManager = new InputManagerClass();
