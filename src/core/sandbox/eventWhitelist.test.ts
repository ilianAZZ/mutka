import { describe, it, expect } from "vitest";
import {
  isSubscribable,
  isNotifyOnly,
  deliverablePayload,
  requiredPermissionFor,
} from "./eventWhitelist";

describe("event whitelist", () => {
  it("allows whitelisted events and rejects everything else", () => {
    expect(isSubscribable("selection:changed")).toBe(true);
    expect(isSubscribable("directory:changed")).toBe(true);
    expect(isSubscribable("clipboard:changed")).toBe(true); // notify-only is still subscribable
    // Host-internal events that would leak other modules' state are NOT subscribable.
    expect(isSubscribable("ui:changed")).toBe(false);
    expect(isSubscribable("statusbar:changed")).toBe(false);
    expect(isSubscribable("error:action")).toBe(false);
  });

  it("strips the payload of notify-only events (occurrence, not data)", () => {
    expect(isNotifyOnly("clipboard:changed")).toBe(true);
    expect(deliverablePayload("clipboard:changed", { secret: "files" })).toBeUndefined();
    // Full-tier events keep their payload.
    expect(isNotifyOnly("selection:changed")).toBe(false);
    expect(deliverablePayload("selection:changed", { items: [1] })).toEqual({ items: [1] });
  });

  it("requires fs:read to receive file:external-drop (it carries file bytes)", () => {
    expect(requiredPermissionFor("file:external-drop")).toBe("fs:read");
    // Ordinary events need no permission to receive.
    expect(requiredPermissionFor("selection:changed")).toBeUndefined();
    expect(requiredPermissionFor("directory:changed")).toBeUndefined();
  });
});
