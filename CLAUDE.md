# Macows Explorer — Project Guide for AI Agents

## What this project is

Macows Explorer is a **community-driven, modular file explorer for macOS** built with:
- **Tauri 2** (Rust backend + native WebView)
- **React 18 + TypeScript** (frontend)
- **Vite** (dev server and bundler)

The design goal: ship a minimal, rock-solid core and let the community build everything else as **modules**. Even built-in features (copy/paste, file creation, navigation) are modules. The core provides infrastructure only.

---

## Philosophy — read this before writing any code

### 1. Small files with one concern each
Every file does ONE thing. If a file exceeds ~150 lines, split it.
A file named `clipboard.ts` contains only clipboard logic.
A file named `FileRow.tsx` renders only a single file row.
Never mix concerns in the same file.

### 2. TypeScript types are the contract
Every public interface lives in `src/core/types.ts`. That file is the law.
No `any`. No `unknown` without a type guard immediately after.
If a shape is unknown at compile time, model it explicitly and guard it.

### 3. Modules own their logic, the core owns infrastructure
The core (`src/core/`) provides: registry, event bus, shortcut manager, type definitions.
The core NEVER contains feature logic (no copy, no navigate, no rename).
Feature logic lives in `src/modules/<module-name>/`.

### 4. Community-first architecture
Every architectural decision must ask: "Can someone outside this repo implement this?"
The `MacowsModule` interface in `src/core/types.ts` is the public API.
The core must never require knowledge of specific modules.

### 5. Liquid Glass macOS native style
The UI follows macOS 26 "Liquid Glass" design. See `src/STYLE_GUIDE.md`.
All colors live in CSS variables. Never hardcode a color.
Dark mode follows the system (+ user override stored in localStorage).

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Window + shell | Tauri 2 | Native WebView, ~15MB binary, Rust for FS ops |
| UI framework | React 18 + TypeScript | Largest contributor pool for community modules |
| Build tool | Vite 5 | Fast HMR during development |
| Styling | CSS variables + backdrop-filter | Liquid Glass without a CSS framework |
| Rust deps | serde, window-vibrancy | Serialization + native macOS vibrancy |

---

## Running the project

```bash
# Prerequisites: Rust + Node.js 18+ + Xcode CLI tools
npm install
npm run tauri dev      # opens app window with HMR
npm run tauri build    # production .app bundle
```

First `tauri dev` takes 3–5 min (Cargo downloads + compiles Tauri).
Subsequent runs are fast (<5s for Rust changes, instant for TS/CSS changes).

---

## Project structure

```
Macows-Explorer/
├── CLAUDE.md                    ← you are here (project overview)
├── INSTALL.md                   ← end-user install guide
│
├── src/                         ← React + TypeScript frontend
│   ├── CLAUDE.md                ← frontend architecture rules
│   ├── STYLE_GUIDE.md           ← macOS visual design rules
│   ├── main.tsx                 ← entry point (mounts React root, imports CSS tokens)
│   ├── App.tsx                  ← root component (no module imports — uses moduleLoader)
│   ├── moduleLoader.ts          ← Vite glob auto-discovery of all modules
│   │
│   ├── styles/                  ← global CSS split by concern
│   │   ├── tokens.css           ← Liquid Glass design tokens (light + dark)
│   │   ├── base.css             ← reset, body, #app shell, scrollbar
│   │   └── toolbar.css          ← toolbar + toolbar button styles
│   │
│   ├── core/                    ← infrastructure only, no features
│   │   ├── CLAUDE.md
│   │   ├── types.ts             ← ALL public interfaces (single source of truth)
│   │   ├── ModuleRegistry.ts    ← register/unregister modules, resolve actions (async)
│   │   ├── EventBus.ts          ← global event bus for loose coupling
│   │   ├── ShortcutManager.ts   ← keyboard shortcut registry (conflict detection)
│   │   └── ThemeManager.ts      ← dark/light/system theme switching
│   │
│   ├── modules/                 ← one folder per module
│   │   ├── CLAUDE.md            ← how to write a module
│   │   ├── navigation/          ← default open handlers (folder→navigate, file→open)
│   │   ├── clipboard/           ← copy (⌘C), cut (⌘X), paste (⌘V) via NSPasteboard
│   │   ├── file-ops/            ← new file, new folder, rename (F2), delete (⌘⌫)
│   │   ├── mouse-navigation/    ← back/forward mouse buttons via Tauri NSEvent events
│   │   └── module-manager/      ← built-in module manager UI (planned)
│   │
│   └── components/              ← reusable UI components (no business logic)
│       ├── CLAUDE.md
│       ├── FileList.tsx         ← scrollable file list, owns selection state
│       ├── FileList.css
│       ├── Breadcrumb.tsx       ← clickable path segments
│       ├── Breadcrumb.css
│       ├── ContextMenu.tsx      ← floating Liquid Glass context menu
│       ├── ContextMenu.css
│       ├── Dialog.tsx           ← Liquid Glass modal (prompt + confirm)
│       ├── Dialog.css
│       └── SettingsPanel/       ← theme picker and app settings
│           ├── SettingsPanel.tsx
│           └── SettingsPanel.css
│
└── src-tauri/                   ← Rust backend
    ├── CLAUDE.md                ← Rust conventions and command guide
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── build.rs
    ├── capabilities/
    │   └── default.json
    ├── icons/
    │   └── icon.png
    └── src/
        ├── main.rs              ← entry point (calls lib::run)
        └── lib.rs               ← all Tauri commands
```

---

## Key architectural flows

### How a module is discovered and registered

```
App.tsx calls loadModules()
  └── src/moduleLoader.ts
        ├── import.meta.glob("./modules/*/index.ts", { eager: true })
        │     ← Vite resolves this at build time; every modules/*/index.ts is included
        ├── iterates all exports, finds objects matching MacowsModule interface
        └── ModuleRegistry.register(module) for each, core modules first:
              ├── stores module in modules Map
              ├── stores each action in actions Map (warns on ID conflict)
              ├── binds each action.shortcut via ShortcutManager (warns on key conflict)
              ├── stores each openHandler sorted by priority (desc)
              ├── stores each sidebarPanel in sidebarPanels array
              └── calls module.onMount()
```

Adding a new module: drop a folder under `src/modules/` — no App.tsx changes needed.

### How a keyboard shortcut executes

```
User presses ⌘C
  → ShortcutManager normalizes key → "meta+c"
  → dispatches CustomEvent("macows:action", { actionId: "core.clipboard.copy" })
  → App.tsx async listener: await ModuleRegistry.executeAction("core.clipboard.copy", ctx)
  → ModuleRegistry: try { await action.execute(ctx) } catch { log + EventBus.emit("error:action") }
  → clipboard module calls invoke("clipboard_write_files", ...) + EventBus.emit("clipboard:changed")
  → App.tsx EventBus listener: setClipboard(state) — React re-renders status bar
```

### How a double-click open resolves

```
User double-clicks a folder
  → FileList calls onOpen(item)
  → App.tsx: await ModuleRegistry.resolveOpen(item, context)
  → ModuleRegistry iterates openHandlers sorted by priority (desc)
  → first handler where matches(item) === true wins
  → default: navigation module at priority 0 → ctx.navigation.navigate(item.path)
  → override: a "tabs" module at priority 10 → opens folder in a new tab
```

### How a dialog is shown from a module

```
Module action calls: const name = await ctx.dialog.prompt({ message: "Rename to:", defaultValue: item.name })
  → App.tsx dialogAPI.prompt() sets dialogState (React state)
  → React renders <Dialog state={dialogState} />
  → User types + clicks OK → Dialog calls state.resolve(inputValue)
  → Promise resolves with the string → module continues execution
```

### How a Tauri command is called

```
TypeScript: await invoke<ReturnType>("command_name", { arg: value })
  → IPC bridge → Rust: #[tauri::command] fn command_name(arg: Type) -> Result<ReturnType, String>
  → Result<T, String>: Ok(value) resolves the Promise, Err(msg) rejects it
```

---

## Open questions for future decisions

> These are documented here so no agent makes these decisions silently.

- **Module registry URL**: Where is the community module registry hosted? (npm tag? Custom JSON endpoint? GitHub topic?)
- **Module permissions**: Should modules declare what Tauri commands they can call? (sandboxing)
- **Module namespace**: Convention for community module IDs — `author.module-name` or `@author/module-name`?
- **Minimum macOS version**: Liquid Glass / NSVisualEffectView requires macOS 10.14+. Tauri 2 requires macOS 10.13+.
- **Code signing**: How are builds distributed? (Homebrew cask? Direct download? Mac App Store?)
