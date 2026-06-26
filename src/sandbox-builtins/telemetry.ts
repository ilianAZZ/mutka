import { defineModule } from "../core/sandbox/defineModule";

// Times how long opening a folder takes, by listening to lifecycle events and
// logging the gaps between them. Pure observer — no permissions, no commands.
//
//   navigation:start  (T0)  → user asked to open a folder
//   listing:loaded    (T1)  → read_dir returned and items were stored (incl. sort)
//   listing:rendered  (T2)  → the rows are committed to the DOM
//   icons:settled     (T3)  → every native icon fetch for those rows has resolved
//
// data       = T1 - T0  (read_dir + IPC + sort — the backend/data half)
// render     = T2 - T1  (React reconciliation + DOM commit — the render half)
// rows-ready = T2 - T0  (when the list is on screen, icons still loading)
// icons      = T3 - T2  (lazy NSWorkspace icon fetches — the part the eye sees
//                        "finish" the folder; scales with unique file types)
//
// The first three are correlated by directory path. icons:settled is global (the
// icon queue is shared), so it's attributed to the most recent render — fine
// because the user opens folders one at a time. Disable from the Modules overlay
// like any other module once the bottleneck is found.
export default defineModule({
  id: "core.telemetry",
  name: "Telemetry",
  version: "1.1.0",
  description: "Logs how long each folder open takes (data, render, icons).",
  permissions: [],
  setup(host) {
    // path → { start, loaded } timestamps (performance.now, ms).
    const pending = new Map<string, { start: number; loaded?: number }>();
    // The most recent listing that finished rendering — for attributing icons:settled.
    let lastRender: { path: string; at: number; count: number } | null = null;

    host.events.on("navigation:start", (payload) => {
      const now = performance.now();
      const { path } = payload as { path: string };
      pending.set(path, { start: now });
    });

    host.events.on("listing:loaded", (payload) => {
      const now = performance.now();
      const { path } = payload as { path: string; count: number };
      const entry = pending.get(path);
      if (entry) entry.loaded = now;
    });

    host.events.on("listing:rendered", (payload) => {
      const end = performance.now();

      const { path, count } = payload as { path: string; count: number };
      const entry = pending.get(path);
      if (!entry) return;
      pending.delete(path);

      const rowsReady = (end - entry.start).toFixed(0);
      const data = entry.loaded !== undefined ? (entry.loaded - entry.start).toFixed(0) : "?";
      const render = entry.loaded !== undefined ? (end - entry.loaded).toFixed(0) : "?";
      host.log(`open "${path}": data=${data}ms render=${render}ms rows-ready=${rowsReady}ms (${count} items)`);
      lastRender = { path, at: end, count };
    });

    host.events.on("icons:settled", () => {
      const now = performance.now();
      if (!lastRender) return;
      const icons = (now - lastRender.at).toFixed(0);
      host.log(`icons "${lastRender.path}": +${icons}ms after rows (all ${lastRender.count} items' icons loaded)`);
      lastRender = null;
    });
  },
});
