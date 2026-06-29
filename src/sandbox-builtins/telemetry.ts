import { defineModule } from "../core/sandbox/defineModule";

// Telemetry — two jobs, both pure observation of whitelisted events:
//
//  1. PERF LOG (local console). Times how long opening a folder takes by listening
//     to the open-folder lifecycle and logging the gaps:
//       navigation:start (T0) → user asked to open a folder
//       listing:loaded   (T1) → read_dir returned and items were stored (incl. sort)
//       listing:rendered (T2) → the rows are committed to the DOM
//       icons:settled    (T3) → every native icon fetch for those rows resolved
//     data = T1-T0 (backend), render = T2-T1 (React), rows-ready = T2-T0,
//     icons = T3-T2. Correlated by path; icons:settled is global so it's attributed
//     to the most recent render (fine — folders open one at a time).
//
//  2. USAGE REPORTING (PostHog). The same events, plus launches / updates / module
//     toggles / command runs, are sent to PostHog as anonymous events keyed by a
//     random per-install id (the "user id" you group by). NO file paths, names, or
//     contents are ever sent — only counts, durations, the app version, and module
//     ids. Egress is host.net (network:public) → Rust → the gateway; the app CSP
//     forbids any other network access. Opt out by setting the module config key
//     `enabled` to "false" (Modules overlay → disable the module entirely also stops
//     it). Folder timings are reported in aggregate, not per directory.
//
// Disable the whole module from the Modules overlay like any other.

// ─── PostHog config ──────────────────────────────────────────────────────────
// Project API key is a PUBLISHABLE client key (safe to embed). Replace with the
// key of a dedicated PostHog project for the desktop app. EU ingestion host to
// match an eu.posthog.com project; use https://us.i.posthog.com for a US project.
const POSTHOG_KEY = "phc_m2xzcvbsJRWkNXXMFy7GW8NPKU8XfZmGwdRwFMqhtbzz";
const POSTHOG_HOST = "https://eu.i.posthog.com";
const FLUSH_DEBOUNCE_MS = 5000; // coalesce bursts of events into one request

interface PhEvent {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export default defineModule({
  id: "core.telemetry",
  name: "Telemetry",
  version: "2.0.0",
  description: "Logs folder-open timing locally and reports anonymous usage to PostHog.",
  permissions: ["network:public", "storage"],
  setup(host) {
    // ── Reporter ───────────────────────────────────────────────────────────
    const enabled = true
    let distinctId: string | null = null;
    let appVersion = "unknown";
    const queue: PhEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    // A stable random id per install (the PostHog "user"). Persisted via config so
    // every launch reports under the same id. No PII — just a UUID.
    async function getDistinctId(): Promise<string> {
      if (distinctId) return distinctId;
      let id = await host.config.get("did");
      if (!id) {
        id = crypto.randomUUID();
        await host.config.set("did", id);
      }
      distinctId = id;
      return id;
    }

    async function reportingOn(): Promise<boolean> {
      if (!enabled) return false;
      // Default ON; only the explicit string "false" opts out.
      return (await host.config.get("enabled")) !== "false";
    }

    function scheduleFlush(): void {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flush();
      }, FLUSH_DEBOUNCE_MS);
    }

    async function flush(): Promise<void> {
      if (queue.length === 0) return;
      const batch = queue.splice(0, queue.length);
      try {
        await host.net.request({
          url: `${POSTHOG_HOST}/batch/`,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
        });
      } catch (err) {
        // Network down / refused: drop this batch (telemetry is best-effort, never
        // retried indefinitely) but keep the module alive.
        host.log("telemetry: flush failed", err);
      }
    }

    async function capture(event: string, properties: Record<string, unknown> = {}): Promise<void> {
      if (!(await reportingOn())) return;
      queue.push({
        event,
        distinct_id: await getDistinctId(),
        properties: { $lib: "mutka", app_version: appVersion, ...properties },
        timestamp: new Date().toISOString(),
      });
      scheduleFlush();
    }

    // ── Launch / update ──────────────────────────────────────────────────────
    // module:registered/unregistered fire for every enabled module at startup,
    // BEFORE app:ready. Gate module tracking on this so we only count genuine
    // runtime enable/install/disable/uninstall, not the startup registration wave.
    let launched = false;

    host.events.on("app:ready", () => {
      void (async () => {
        try {
          appVersion = await host.sys.appVersion();
        } catch {
          /* keep "unknown" */
        }
        const seen = await host.config.get("lastVersion");
        if (seen === null) {
          await capture("app_installed");
        } else if (seen !== appVersion) {
          await capture("app_updated", { from_version: seen, to_version: appVersion });
        }
        await host.config.set("lastVersion", appVersion);
        // Enrich the PostHog person profile with the current version + UA.
        await capture("app_opened", { $set: { app_version: appVersion, user_agent: navigator.userAgent } });
        await flush(); // send the launch events promptly, don't wait for the debounce
        launched = true;
      })();
    });

    // ── Module toggles (runtime only — see `launched`) ───────────────────────
    host.events.on("module:registered", (payload) => {
      if (!launched) return;
      const { moduleId } = payload as { moduleId: string };
      void capture("module_enabled", { module_id: moduleId });
    });
    host.events.on("module:unregistered", (payload) => {
      if (!launched) return;
      const { moduleId } = payload as { moduleId: string };
      void capture("module_disabled", { module_id: moduleId });
    });

    // ── Command runs ─────────────────────────────────────────────────────────
    // action:dispatch delivers the id of the command that ran (a static feature
    // id, e.g. "core.clipboard.copy" — no user data), so we report which command
    // ran. PostHog then ranks command popularity.
    host.events.on("action:dispatch", (payload) => {
      const { actionId } = (payload ?? {}) as { actionId?: string };
      void capture("command_run", { command_id: actionId ?? "unknown" });
    });

    // ── Folder-open timing (perf log + reported durations) ───────────────────
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

      const rowsReady = end - entry.start;
      const data = entry.loaded !== undefined ? entry.loaded - entry.start : undefined;
      const render = entry.loaded !== undefined ? end - entry.loaded : undefined;
      host.log(
        `open "${path}": data=${data?.toFixed(0) ?? "?"}ms render=${render?.toFixed(0) ?? "?"}ms ` +
          `rows-ready=${rowsReady.toFixed(0)}ms (${count} items)`
      );
      lastRender = { path, at: end, count };
      // Report durations + item count only — never the path (it reveals the user's
      // directory structure). PostHog averages these for "average loading time".
      void capture("folder_opened", {
        data_ms: data !== undefined ? Math.round(data) : null,
        render_ms: render !== undefined ? Math.round(render) : null,
        rows_ready_ms: Math.round(rowsReady),
        item_count: count,
      });
    });

    host.events.on("icons:settled", () => {
      const now = performance.now();
      if (!lastRender) return;
      const icons = now - lastRender.at;
      host.log(`icons "${lastRender.path}": +${icons.toFixed(0)}ms after rows (all ${lastRender.count} items' icons loaded)`);
      void capture("icons_settled", { icons_ms: Math.round(icons), item_count: lastRender.count });
      lastRender = null;
    });
  },
});
