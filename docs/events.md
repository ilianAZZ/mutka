# Event Reference

> **Keep this table in sync with the code.**
> Add a row whenever you add an event to `src/core/event-bus/events.ts`, and remove a row when you delete one.

All events are typed in `EventMap` (`src/core/event-bus/events.ts`). Use the `Events`
constants — never raw strings.

---

## Core events

| Constant | String key | Payload | Emitted by | Consumed by |
|---|---|---|---|---|
| `Events.Theme.changed` | `"theme:changed"` | `{ preference, resolved }` | `ThemeManager` | Theme-aware components |
| `Events.Clipboard.changed` | `"clipboard:changed"` | `ClipboardState` | `ClipboardStore` (via the clipboard module) | `App.tsx` → `setClipboard()` |
| `Events.Navigation.back` | `"navigation:back"` | `undefined` | `goBack()` in `App.tsx` | `App.tsx` → toolbar flash animation |
| `Events.Navigation.forward` | `"navigation:forward"` | `undefined` | `goForward()` in `App.tsx` | `App.tsx` → toolbar flash animation |
| `Events.Navigation.start` | `"navigation:start"` | `{ path }` | `navigateTo()` (`useNavigation`) | `core.telemetry` (open-folder timing) |
| `Events.File.modifierOpen` | `"file:modifier-open"` | `{ item, modifiers }` | `App.tsx` | `core.tabs` module (ctrl/⌘-open in tab) |
| `Events.Module.registered` | `"module:registered"` | `{ moduleId }` | `ModuleRegistry` | `App.tsx` → refresh sidebar panels |
| `Events.Module.unregistered` | `"module:unregistered"` | `{ moduleId }` | `ModuleRegistry` | `App.tsx` → refresh sidebar panels |
| `Events.Error.action` | `"error:action"` | `{ actionId, error }` | `ModuleRegistry` | Future toast/notification module |
| `Events.Input.mouseNavigate` | `"input:mouse-navigate"` | `{ direction }` | `InputManager` | `core.mouse-navigation` module |
| `Events.Action.dispatch` | `"action:dispatch"` | `{ actionId }` | `ShortcutManager`, modules | `ModuleRegistry.executeAction()` (wired in `MR.init()`) |
| `Events.Selection.changed` | `"selection:changed"` | `{ items }` | `SelectionStore` | `App.tsx` → `setSelected()` |
| `Events.Listing.loaded` | `"listing:loaded"` | `{ path, count }` | `useDirectoryListing` (after `read_dir`) | `core.telemetry` (data-fetch timing) |
| `Events.Listing.rendered` | `"listing:rendered"` | `{ path, count }` | `FileList` (rows committed to DOM) | `core.telemetry` (render timing) |
| `Events.Icons.settled` | `"icons:settled"` | `undefined` | `FileIconRegistry` (icon fetch queue drained) | `core.telemetry` (icon-load timing) |
| `Events.Tabs.changed` | `"tabs:changed"` | `TabsSnapshot` | `TabManager` | `App.tsx` → `setTabsSnap()` |
| `Events.Tabs.lastClosed` | `"tabs:last-closed"` | `{ path }` | `TabManager` | `App.tsx` → sync global nav state |
| `Events.Ui.changed` | `"ui:changed"` | `{ moduleId, surfaceId }` | `UIStore` (via `ui` capability) | `DeclarativePanel` / `DeclarativeModal` re-render |
| `Events.StatusBar.changed` | `"statusbar:changed"` | `undefined` | `StatusBarStore` (via `statusbar` capability) | `StatusBar` → re-read items |
| `Events.Directory.changed` | `"directory:changed"` | `{ path }` | `DirectoryWatcher` (Rust `notify`) | `core.auto-refresh` + modules |
| `Events.ModulesUi.changed` | `"modules-ui:changed"` | `{ open }` | `ModulesStore` | `App.tsx` → render the Modules overlay |

---

## Which events a sandboxed module may subscribe to

A module subscribes via `host.events.on(eventName, handler)` inside `setup`. This is a
**trust surface**, so it is deliberately narrow. No event carries a credential — the
only things on the bus are file paths/names, a few booleans/ids, and (for
`file:external-drop`) file bytes — so the gate is about **privacy**, not secrecy, and
it has **two tiers** in `src/core/sandbox/eventWhitelist.ts`:

**`SUBSCRIBABLE_EVENTS`** — forwarded **with** their payload.

| Whitelisted event | Used by |
|---|---|
| `"input:mouse-navigate"` | `core.mouse-navigation` (back/forward buttons) |
| `"file:modifier-open"` | `core.tabs` (ctrl/⌘-click a folder → open in a tab) |
| `"directory:changed"` | `core.auto-refresh` (re-read list when the dir changes on disk) |
| `"navigation:start"` · `"listing:loaded"` · `"listing:rendered"` · `"icons:settled"` | `core.telemetry` (times each folder open: data fetch, render, icons) |
| `"action:dispatch"` | `core.telemetry` (reports which command ran — payload is `{ actionId }`, a static feature id, not user data) |
| `"selection:changed"` | declarative panels reacting to the selection |
| `"navigation:back"` · `"navigation:forward"` | nav-aware modules reacting to history moves |
| `"theme:changed"` · `"view:changed"` · `"settings:changed"` · `"modules-ui:changed"` · `"sidebar:changed"` · `"module:registered"` · `"module:unregistered"` · `"columns:cell-resolved"` · `"columns:widths-changed"` | trivial signals (booleans / ids / theme) — nothing to protect |
| `"app:ready"` · `"file:middle-open"` · `"file:open-no-app"` · `"file:external-drop"` · `"sidebar:item-remove"` | various (e.g. `com.webdav` removes a sidebar account on `sidebar:item-remove`) |

**`NOTIFY_ONLY_EVENTS`** — forwarded as a bare ping, **payload stripped to
`undefined`**. The occurrence is useful but the payload is profiling-grade.

| Notify-only event | Why stripped | How to get the data |
| --- | --- | --- |
| `"clipboard:changed"` | full clipboard contents | re-read via `host.board.readFiles()` (`clipboard:read`) |
| `"tabs:changed"` | every open tab's path | — (react to the ping only) |

For a worker module, `SandboxHost` subscribes on the EventBus and re-posts over
postMessage; for a built-in, `LocalHost` subscribes directly. Either way the whitelist
is checked first and `deliverablePayload(event, payload)` strips notify-only payloads.
Events on **neither** list — `error:action` (arbitrary internals) and `ui:changed` /
`statusbar:changed` (would leak other modules' surfaces) — are host-internal and never
exposed to modules.

---

## Adding a new event (core)

1. Add the entry to `EventMap` in `src/core/event-bus/events.ts`:
   ```typescript
   "my-subsystem:did-something": { path: string };
   ```
2. Add a constant to the `Events` object in the same file:
   ```typescript
   MySubsystem: {
     didSomething: "my-subsystem:did-something",
   },
   ```
3. Add a row to the table above.
4. If a module should be able to subscribe to it, add it to `eventWhitelist.ts`:
   `SUBSCRIBABLE_EVENTS` to deliver it with its payload (only if the payload carries
   no sensitive state), or `NOTIFY_ONLY_EVENTS` to deliver it as a bare ping with the
   payload stripped (when the occurrence is useful but the payload is profiling-grade).

---

## Custom events from community modules

A module can declare its own events via declaration merging on `EventMap`
(see the comment block at the top of `events.ts`):

```typescript
declare module "../../core/event-bus/events" {
  interface EventMap {
    "acme.git-status:repo-changed": { path: string };
  }
}
```

> **Naming convention:** `"<module-id>:<past-tense-verb>"` — e.g.
> `"acme.git-status:repo-changed"`. Module-scoped events must be prefixed with the
> module ID to avoid collisions.

Note that a sandboxed (worker) module cannot reach the EventBus directly — it has no
core reference. It only receives the whitelisted events the host forwards to it, and
emits side effects through `host.*` capabilities. Cross-module event broadcasting from
within a worker is not a supported path today.
