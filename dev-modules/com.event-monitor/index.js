// EXAMPLE / DEV MODULE — a live event bus monitor. Untrusted, runs ISOLATED in a
// Web Worker. It subscribes to every event a sandboxed module is *allowed* to see
// (the host's SUBSCRIBABLE_EVENTS whitelist — see core/sandbox/eventWhitelist.ts)
// and shows them streaming in real time, two ways at once:
//
//   • a right-pane panel that renders the most recent events as a live list
//   • host.log(...) for each event, so they also stream to the dev console
//
// IMPORTANT — what "all bus events" means here: a module canNOT see literally
// every EventBus event. The host deliberately gates host.events.on() to a narrow
// whitelist so untrusted code never receives sensitive internal state. This module
// listens to that whole whitelist; anything not on it (e.g. theme:changed,
// tabs:changed, clipboard:changed) is simply not reachable from a sandbox. To
// watch one of those too, add it to SUBSCRIBABLE_EVENTS in the core — that widens
// the trust surface on purpose, so it's a deliberate edit, not something a module
// can grant itself.
export default {
  id: "com.event-monitor",
  name: "Event Monitor",
  version: "1.0.0",
  icon: "data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%3E%3Crect%20width%3D'24'%20height%3D'24'%20rx%3D'6'%20fill%3D'%238b5cf6'%2F%3E%3Ccircle%20cx%3D'12'%20cy%3D'15'%20r%3D'1.8'%20fill%3D'%23fff'%2F%3E%3Cpath%20d%3D'M8.8%2015a3.2%203.2%200%200%201%206.4%200M6.5%2015a5.5%205.5%200%200%201%2011%200'%20stroke%3D'%23fff'%20stroke-width%3D'1.4'%20fill%3D'none'%20stroke-linecap%3D'round'%2F%3E%3C%2Fsvg%3E",
  author: { name: "Ilian", github: "ilianAZZ" },
  tags: ["dev","events","debug"],
  description: "Live-streams every subscribable bus event to a side panel and the console.",
  permissions: ["ui"],
  panels: [
    { id: "log", title: "Event Monitor", icon: "📡", side: "right", defaultWidth: 320 },
  ],
  setup(host) {
    // Every event a sandboxed module is permitted to subscribe to. Mirrors
    // core/sandbox/eventWhitelist.ts — subscribing to anything outside this set
    // is a no-op the host refuses, so there's no point listing more.
    //
    // Two tiers: full-payload events (SUBSCRIBABLE_EVENTS) arrive with their
    // data; notify-only events (NOTIFY_ONLY_EVENTS) arrive as a bare ping with
    // the payload stripped to `undefined` — the host hides the profiling-grade
    // data, you just learn it happened.
    const FULL_EVENTS = [
      "app:ready",
      "input:mouse-navigate",
      "selection:changed",
      "file:modifier-open",
      "file:middle-open",
      "file:open-no-app",
      "file:external-drop",
      "sidebar:item-remove",
      "directory:changed",
      "navigation:start",
      "navigation:back",
      "navigation:forward",
      "listing:loaded",
      "listing:rendered",
      "icons:settled",
      "theme:changed",
      "view:changed",
      "settings:changed",
      "modules-ui:changed",
      "sidebar:changed",
      "module:registered",
      "module:unregistered",
      "columns:cell-resolved",
      "columns:widths-changed",
    ];
    const NOTIFY_ONLY_EVENTS = ["clipboard:changed", "tabs:changed", "action:dispatch"];
    const NOTIFY_ONLY = new Set(NOTIFY_ONLY_EVENTS);
    const EVENTS = [...FULL_EVENTS, ...NOTIFY_ONLY_EVENTS];

    const MAX_ROWS = 60; // ring buffer — newest first
    const entries = [];  // { seq, event, summary, time }
    let seq = 0;

    // A compact, injection-safe one-line view of a payload. Never rendered as
    // markup (the host draws every node natively), but we still keep it short so
    // the list stays readable.
    function summarize(payload) {
      if (payload === undefined || payload === null) return "—";
      try {
        if (typeof payload !== "object") return String(payload);
        const json = JSON.stringify(payload, (_k, v) =>
          typeof v === "string" && v.length > 80 ? v.slice(0, 77) + "…" : v
        );
        return json.length > 140 ? json.slice(0, 137) + "…" : json;
      } catch {
        return "[unserializable]";
      }
    }

    function clockLabel() {
      // Date is available in a worker; format HH:MM:SS for the row detail.
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    function panelTree() {
      const header = {
        type: "hstack",
        align: "center",
        gap: 8,
        children: [
          { type: "text", text: "Event Monitor", weight: "bold" },
          { type: "spacer" },
          { type: "badge", text: `${seq}`, tint: "var(--accent)" },
          { type: "button", label: "Clear", action: "clear", variant: "default" },
        ],
      };

      if (entries.length === 0) {
        return {
          type: "vstack",
          gap: 10,
          children: [
            header,
            { type: "divider" },
            { type: "text", text: "Waiting for events… interact with the app.", muted: true, size: "sm" },
          ],
        };
      }

      const items = entries.map((e) => ({
        id: String(e.seq),
        label: e.event,
        detail: `${e.time} · ${e.summary}`,
        // Dim notify-only rows so the two tiers read apart at a glance.
        tint: e.notifyOnly ? "var(--text-subtle)" : undefined,
      }));

      return {
        type: "vstack",
        gap: 8,
        children: [
          header,
          { type: "text", text: `last ${entries.length} of ${seq} total`, muted: true, size: "sm" },
          { type: "divider" },
          { type: "list", items },
        ],
      };
    }

    function render() {
      host.ui.render("log", panelTree());
    }

    function record(event, payload) {
      seq += 1;
      const notifyOnly = NOTIFY_ONLY.has(event);
      // Notify-only events arrive with payload === undefined by design; label
      // them so the stripped payload isn't mistaken for "no data".
      const summary = notifyOnly ? "ping · payload hidden" : summarize(payload);
      entries.unshift({ seq, event, summary, time: clockLabel(), notifyOnly });
      if (entries.length > MAX_ROWS) entries.pop();
      host.log(notifyOnly ? `[${event}] (notify-only)` : `[${event}]`, payload);
      render();
    }

    // Wire one subscription per whitelisted event.
    for (const event of EVENTS) {
      host.events.on(event, (payload) => record(event, payload));
    }

    // The Clear button empties the buffer (the total counter keeps climbing).
    host.onUIEvent("clear", () => {
      entries.length = 0;
      render();
    });

    // Paint the empty state immediately so the panel isn't blank before the first
    // event arrives. (app:ready will also fire through the loop above.)
    render();
  },
};
